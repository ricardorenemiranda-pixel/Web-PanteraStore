import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'mythical'
  | 'legendary'
  | 'immortal'
  | 'arcana'
  | 'ancient';

export type ItemCategory = 'hero' | 'courier' | 'weather' | 'treasure';

/** Una pieza individual de un set abierto. Ya no se genera automáticamente (el catálogo es manual), queda por compatibilidad. */
export interface SetPiece {
  marketHashName: string;
  name: string;
  slot: string;
  imageUrl: string;
  /** Precio de referencia de Steam de esa pieza sola, sin markup (S/) */
  marketPrice: number;
}

export interface ItemProps {
  id: string;
  /**
   * Código corto único, generado al crear el item — sirve para que el
   * admin ubique rápido un item cuando un cliente le escribe por WhatsApp
   * mencionándolo, sin tener que buscar por nombre.
   */
  referenceCode: string;
  /** market_hash_name real de Steam, si el admin lo cargó — habilita "Consultar precio Steam". */
  steamMarketHashName?: string;
  name: string;
  hero?: string;
  category: ItemCategory;
  rarity: Rarity;
  /** Descripción libre para mostrar en el catálogo público. */
  description?: string;
  /** Último precio de referencia leído del Steam Market (S/) */
  marketPrice: number;
  /** Markup en % aplicado solo a este item. Si es null, se usa el markup global. */
  markupPercentOverride: number | null;
  imageUrl?: string;
  dateAdded: Date;
  /** Copias disponibles, cargado a mano por el admin. */
  stock?: number;
  /** Fechas (ordenadas) en que se liberan copias que hoy están en trade hold. */
  pendingHolds?: Date[];
  /** Precio final puesto a mano por el admin (S/). Si está, gana sobre el cálculo por markup. */
  manualPriceOverride?: number | null;
  /** false = borrador, no sale en el catálogo público. */
  published?: boolean;
  /** Piezas de un set abierto (categoría 'treasure'). Vacío para cofres cerrados e ítems normales. */
  setPieces?: SetPiece[];
}

const MIN_MARKUP_PERCENT = 0;
const MAX_MARKUP_PERCENT = 300;

/**
 * Entidad de dominio: nada de decoradores de NestJS/TypeORM acá. Encapsula
 * la única regla de negocio que de verdad importa en el catálogo: el precio
 * de venta siempre se deriva del precio de Steam Market + el markup vigente,
 * nunca se guarda como número suelto editable a mano.
 */
export class Item {
  private constructor(private props: ItemProps) {}

  static create(props: ItemProps): Item {
    const item = new Item({
      ...props,
      stock: props.stock ?? 0,
      pendingHolds: props.pendingHolds ?? [],
      manualPriceOverride: props.manualPriceOverride ?? null,
      published: props.published ?? true,
      setPieces: props.setPieces ?? [],
    });
    item.validateMarketPrice(props.marketPrice);
    if (props.markupPercentOverride !== null) {
      item.validateMarkup(props.markupPercentOverride);
    }
    if (props.manualPriceOverride) {
      item.validatePrice(props.manualPriceOverride);
    }
    return item;
  }

  get id(): string {
    return this.props.id;
  }

  get referenceCode(): string {
    return this.props.referenceCode;
  }

  get steamMarketHashName(): string | undefined {
    return this.props.steamMarketHashName;
  }

  get name(): string {
    return this.props.name;
  }

  get hero(): string | undefined {
    return this.props.hero;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get category(): ItemCategory {
    return this.props.category;
  }

  get rarity(): Rarity {
    return this.props.rarity;
  }

  get marketPrice(): number {
    return this.props.marketPrice;
  }

  get markupPercentOverride(): number | null {
    return this.props.markupPercentOverride;
  }

  get manualPriceOverride(): number | null {
    return this.props.manualPriceOverride ?? null;
  }

  get published(): boolean {
    return this.props.published ?? true;
  }

  get imageUrl(): string | undefined {
    return this.props.imageUrl;
  }

  get dateAdded(): Date {
    return this.props.dateAdded;
  }

  get stock(): number {
    return this.props.stock ?? 0;
  }

  get pendingHolds(): Date[] {
    return [...(this.props.pendingHolds ?? [])];
  }

  get setPieces(): SetPiece[] {
    return [...(this.props.setPieces ?? [])];
  }

  /** true si hay al menos una copia lista para vender ahora mismo. */
  isAvailable(): boolean {
    return this.stock > 0;
  }

  /**
   * Precio final al público. Si el admin puso un precio a mano
   * (manualPriceOverride), ese gana siempre — el cálculo por markup es
   * solo el default mientras no se decide un precio propio.
   */
  sellPrice(globalMarkupPercent: number): number {
    if (this.props.manualPriceOverride !== null && this.props.manualPriceOverride !== undefined) {
      return this.props.manualPriceOverride;
    }
    const markup = this.props.markupPercentOverride ?? globalMarkupPercent;
    return this.roundToCents(this.props.marketPrice * (1 + markup / 100));
  }

  /** Precio que la empresa paga al usuario si decide vender este item (recompra). */
  buybackPrice(globalMarkupPercent: number, buybackDiscountPercent: number): number {
    const sellPrice = this.sellPrice(globalMarkupPercent);
    return this.roundToCents(sellPrice * (1 - buybackDiscountPercent / 100));
  }

  updateMarketPrice(newMarketPrice: number): void {
    this.validateMarketPrice(newMarketPrice);
    this.props.marketPrice = newMarketPrice;
  }

  updateMarkupOverride(markupPercent: number | null): void {
    if (markupPercent !== null) {
      this.validateMarkup(markupPercent);
    }
    this.props.markupPercentOverride = markupPercent;
  }

  /** Precio final puesto a mano por el admin. null = volver a calcularlo por markup. */
  updateManualPriceOverride(price: number | null): void {
    if (price !== null) {
      this.validatePrice(price);
    }
    this.props.manualPriceOverride = price;
  }

  /** El admin revisó el item (precio, etc.) y lo aprueba para que salga en el catálogo público. */
  publish(): void {
    this.props.published = true;
  }

  /** Publicado/borrador, editable a mano por el admin. */
  updatePublished(published: boolean): void {
    this.props.published = published;
  }

  updateName(name: string): void {
    this.props.name = name;
  }

  updateHero(hero: string | undefined): void {
    this.props.hero = hero;
  }

  updateCategory(category: ItemCategory): void {
    this.props.category = category;
  }

  updateRarity(rarity: Rarity): void {
    this.props.rarity = rarity;
  }

  updateDescription(description: string | undefined): void {
    this.props.description = description;
  }

  updateImageUrl(imageUrl: string | undefined): void {
    this.props.imageUrl = imageUrl;
  }

  updateSteamMarketHashName(steamMarketHashName: string | undefined): void {
    this.props.steamMarketHashName = steamMarketHashName;
  }

  updateStock(stock: number): void {
    if (stock < 0) {
      throw new InvalidDomainStateException(`El stock no puede ser negativo (recibido: ${stock}).`);
    }
    this.props.stock = stock;
  }

  updatePendingHolds(dates: Date[]): void {
    this.props.pendingHolds = [...dates].sort((a, b) => a.getTime() - b.getTime());
  }

  updateSetPieces(pieces: SetPiece[]): void {
    this.props.setPieces = [...pieces];
  }

  private validateMarketPrice(price: number): void {
    if (price < 0) {
      throw new InvalidDomainStateException(
        `El precio de mercado no puede ser negativo (recibido: ${price}).`,
      );
    }
  }

  private validateMarkup(percent: number): void {
    if (percent < MIN_MARKUP_PERCENT || percent > MAX_MARKUP_PERCENT) {
      throw new InvalidDomainStateException(
        `El markup debe estar entre ${MIN_MARKUP_PERCENT}% y ${MAX_MARKUP_PERCENT}% (recibido: ${percent}%).`,
      );
    }
  }

  private validatePrice(price: number): void {
    if (price < 0) {
      throw new InvalidDomainStateException(`El precio no puede ser negativo (recibido: ${price}).`);
    }
  }

  private roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
