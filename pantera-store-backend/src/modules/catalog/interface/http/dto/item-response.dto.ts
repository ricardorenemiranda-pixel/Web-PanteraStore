import { ItemCategory, Rarity } from '../../../domain/entities/item.entity';
import { ItemWithPrice } from '../../../application/dto/item-with-price.dto';

/** Una pieza de un set abierto, con su precio ya prorrateado del precio final del set. */
export class SetPieceResponseDto {
  name: string;
  slot: string;
  imageUrl: string;
  price: number;
}

/**
 * Lo que de verdad viaja por HTTP. Nunca se serializa la entidad de dominio
 * directamente — así el dominio puede cambiar su forma interna sin romper
 * el contrato de la API.
 */
export class ItemResponseDto {
  id: string;
  name: string;
  hero?: string;
  category: ItemCategory;
  rarity: Rarity;
  marketPrice: number;
  price: number;
  buybackPrice: number;
  markupPercentOverride: number | null;
  /** Precio final puesto a mano por el admin (S/). Si está, es lo que se cobra — no se recalcula por markup. */
  manualPriceOverride: number | null;
  imageUrl?: string;
  dateAdded: string;
  stock: number;
  /** Fechas ISO en que se liberan copias que hoy están en trade hold (vacío = nada pendiente). */
  pendingHolds: string[];
  /** false = todavía no lo aprobó el admin, no sale en el catálogo público. */
  published: boolean;
  /** Piezas de un set abierto (categoría "treasure"). Vacío para cofres cerrados e ítems normales. */
  setPieces: SetPieceResponseDto[];

  static fromDomain(itemWithPrice: ItemWithPrice): ItemResponseDto {
    const { item, sellPrice, buybackPrice } = itemWithPrice;
    const dto = new ItemResponseDto();
    dto.id = item.id;
    dto.name = item.name;
    dto.hero = item.hero;
    dto.category = item.category;
    dto.rarity = item.rarity;
    dto.marketPrice = item.marketPrice;
    dto.price = sellPrice;
    dto.buybackPrice = buybackPrice;
    dto.markupPercentOverride = item.markupPercentOverride;
    dto.manualPriceOverride = item.manualPriceOverride;
    dto.imageUrl = item.imageUrl;
    dto.dateAdded = item.dateAdded.toISOString();
    dto.stock = item.stock;
    dto.pendingHolds = item.pendingHolds.map((d) => d.toISOString());
    dto.published = item.published;
    // Cada pieza cobra la misma proporción del precio final del set que
    // representa su precio de Steam sobre el precio de Steam del set
    // completo — así funciona igual si el admin puso un precio manual al
    // set (se reparte proporcional) que si es puro cálculo por markup.
    dto.setPieces = item.setPieces.map((piece) => {
      const proportion = item.marketPrice > 0 ? piece.marketPrice / item.marketPrice : 0;
      const price = Math.round(proportion * sellPrice * 100) / 100;
      return { name: piece.name, slot: piece.slot, imageUrl: piece.imageUrl, price };
    });
    return dto;
  }
}
