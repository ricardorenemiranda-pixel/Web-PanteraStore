import { Inject, Injectable, Logger } from '@nestjs/common';
import { mapWithConcurrency } from '../../../../shared/application/concurrency';
import type { InventoryItem } from '../../../inventory/domain/ports/inventory.port';
import { Item, ItemCategory, Rarity, SetPiece } from '../../domain/entities/item.entity';
import { ITEM_REPOSITORY, type ItemRepository } from '../../domain/ports/item.repository.port';
import {
  PRICING_CONFIG_REPOSITORY,
  type PricingConfigRepository,
} from '../../domain/ports/pricing-config.repository.port';
import { STEAM_MARKET_GATEWAY, type SteamMarketGateway } from '../../domain/ports/steam-market.port';
import {
  WAREHOUSE_ACCOUNT_REPOSITORY,
  type WarehouseAccountRepository,
} from '../../domain/ports/warehouse-account.repository.port';
import {
  WAREHOUSE_INVENTORY_GATEWAY,
  type WarehouseInventoryGateway,
} from '../../domain/ports/warehouse-inventory.port';

const STEAM_PRICE_CONCURRENCY = 2;

/** Prefijo de la clave sintética de upsert para sets abiertos (no hay un solo market_hash_name real de Steam). */
const SET_KEY_PREFIX = 'SET::';

interface ItemGroup {
  category: ItemCategory;
  rarity: Rarity;
  name: string;
  hero: string | null;
  imageUrl: string;
  stock: number;
  pendingHolds: Date[];
}

/** Acumulador de una pieza de set (ej. "Head") mientras se escanean las cuentas. */
interface SetPieceAccumulator {
  slot: string;
  name: string;
  imageUrl: string;
  marketHashName: string;
  tradableCount: number;
  pendingHolds: Date[];
}

/** Acumulador de un set completo (ej. "King of Fools" de Ringmaster) mientras se escanean las cuentas. */
interface SetGroupAccumulator {
  hero: string;
  setName: string;
  rarity: Rarity;
  pieces: Map<string, SetPieceAccumulator>; // clave: slot
}

/**
 * Lee el inventario real de todas las cuentas de almacén registradas y
 * arma/actualiza el catálogo (`Item`) a partir de eso. Un item que ya existe
 * (mismo market_hash_name) solo actualiza su stock/precio/holds — nunca se
 * duplica ni se vuelve a pedir aprobación. Un item que nunca se había visto
 * se crea como pendiente (`published: false`): no sale en el catálogo
 * público hasta que el admin lo revise y lo publique a mano. Nunca toca
 * `markupPercentOverride`/`manualPriceOverride`: el precio que puso el admin
 * a mano sobrevive siempre a un sync.
 *
 * Además de ítems sueltos (hero/courier/weather), este proceso reconoce dos
 * casos especiales de cofres/sets de Dota 2:
 *  - Cofre cerrado (tag `Type: Treasure`): se trata como un ítem normal más,
 *    categoría `treasure`.
 *  - Set abierto (varias piezas separadas del mismo héroe, ej. "King of
 *    Fools - Head/Weapon/Armor/Belt"): se agrupan en UN solo `Item` con
 *    `setPieces` poblado, categoría `treasure`, precio = suma de las piezas.
 */
@Injectable()
export class SyncWarehouseCatalogUseCase {
  private readonly logger = new Logger(SyncWarehouseCatalogUseCase.name);
  private syncing = false;

  constructor(
    @Inject(WAREHOUSE_ACCOUNT_REPOSITORY) private readonly warehouseAccounts: WarehouseAccountRepository,
    @Inject(WAREHOUSE_INVENTORY_GATEWAY) private readonly inventory: WarehouseInventoryGateway,
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
    @Inject(STEAM_MARKET_GATEWAY) private readonly steamMarket: SteamMarketGateway,
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
  ) {}

  async execute(): Promise<void> {
    if (this.syncing) {
      this.logger.warn('Ya hay una sincronización de almacén en curso, se ignora este pedido.');
      return;
    }

    this.syncing = true;
    try {
      const accounts = await this.warehouseAccounts.findAll();
      const { groups, setGroups } = await this.scanAccounts(accounts.map((a) => a.steamId));

      await mapWithConcurrency(
        Array.from(groups.entries()),
        STEAM_PRICE_CONCURRENCY,
        async ([marketHashName, group]) => this.upsertItem(marketHashName, group),
      );
      await mapWithConcurrency(
        Array.from(setGroups.entries()),
        STEAM_PRICE_CONCURRENCY,
        async ([setKey, setGroup]) => this.upsertSetItem(setKey, setGroup),
      );

      const seenKeys = new Set([...groups.keys(), ...setGroups.keys()]);
      await this.markMissingItemsAsOutOfStock(seenKeys);
      await this.pricingConfig.setLastWarehouseSyncAt(new Date());
      this.logger.log(
        `Sincronización de almacén completa: ${groups.size} item(s) sueltos, ${setGroups.size} set(s)/cofre(s).`,
      );
    } finally {
      this.syncing = false;
    }
  }

  private async scanAccounts(
    steamIds: string[],
  ): Promise<{ groups: Map<string, ItemGroup>; setGroups: Map<string, SetGroupAccumulator> }> {
    const groups = new Map<string, ItemGroup>();
    const setGroups = new Map<string, SetGroupAccumulator>();

    for (const steamId of steamIds) {
      const inventory = await this.inventory.getDota2Inventory(steamId);

      for (const item of inventory) {
        if (!item.marketable || item.rarity === null) continue;

        if (this.isSetPiece(item)) {
          this.accumulateSetPiece(setGroups, item);
          continue;
        }

        const category = this.resolveCategory(item);
        if (!category) continue;
        this.accumulateItem(groups, item, category);
      }
    }

    return { groups, setGroups };
  }

  private accumulateItem(groups: Map<string, ItemGroup>, item: InventoryItem, category: ItemCategory): void {
    // El "!" es seguro: scanAccounts ya filtró item.rarity === null antes de llamar acá.
    const rarity = item.rarity as Rarity;
    const existing = groups.get(item.marketHashName);
    if (!existing) {
      groups.set(item.marketHashName, {
        category,
        rarity,
        name: item.name,
        hero: item.hero,
        imageUrl: item.imageUrl,
        stock: item.tradable ? 1 : 0,
        pendingHolds: !item.tradable && item.tradeHoldUntil ? [item.tradeHoldUntil] : [],
      });
      return;
    }
    if (item.tradable) {
      existing.stock += 1;
    } else if (item.tradeHoldUntil) {
      existing.pendingHolds.push(item.tradeHoldUntil);
    }
  }

  private accumulateSetPiece(setGroups: Map<string, SetGroupAccumulator>, item: InventoryItem): void {
    const hero = item.hero as string; // isSetPiece ya garantizó que no es null
    const slot = item.slotTag as string; // idem
    const setName = this.setNameOf(item.name);
    const key = `${hero}::${setName}`;

    let group = setGroups.get(key);
    if (!group) {
      group = { hero, setName, rarity: item.rarity as Rarity, pieces: new Map() };
      setGroups.set(key, group);
    }

    let piece = group.pieces.get(slot);
    if (!piece) {
      piece = {
        slot,
        name: item.name,
        imageUrl: item.imageUrl,
        marketHashName: item.marketHashName,
        tradableCount: 0,
        pendingHolds: [],
      };
      group.pieces.set(slot, piece);
    }

    if (item.tradable) {
      piece.tradableCount += 1;
    } else if (item.tradeHoldUntil) {
      piece.pendingHolds.push(item.tradeHoldUntil);
    }
  }

  /**
   * Una pieza de set abierto tiene héroe real, un slot real (no "N/A"), y su
   * nombre sigue el patrón "{Nombre del set} - {Nombre de la pieza}" (ej.
   * "King of Fools - Head", "Laurels of the Dawnstar - Cape"). Ojo: el
   * nombre de la pieza NO siempre calza exacto con el tag `Slot` de Steam
   * (ej. pieza "Cape" con tag Slot="Shoulder", o "Shoulders" con
   * Slot="Shoulder" en singular) — Steam le pone a cada pieza un nombre de
   * fantasía propio, así que no sirve comparar contra el tag. Lo único
   * confiable es el patrón del nombre con guion.
   */
  private isSetPiece(item: InventoryItem): boolean {
    if (item.hero === null || item.slotTag === null || item.slotTag === 'N/A') return false;
    return item.name.includes(' - ');
  }

  private setNameOf(fullName: string): string {
    return fullName.slice(0, fullName.lastIndexOf(' - '));
  }

  private resolveCategory(item: InventoryItem): ItemCategory | null {
    // "Treasure" = cofre clásico (contenido al azar). "Bundle" = cache de
    // set completo de un héroe (ej. "Tangled Tropics"): un solo ítem con
    // botón ABRIR/EQUIPAR y un solo uso — mismo trato que un cofre cerrado.
    if (item.typeTag === 'Treasure' || item.typeTag === 'Bundle') return 'treasure';
    if (item.hero !== null) return 'hero';
    if (item.typeTag === 'Courier') return 'courier';
    if (item.typeTag === 'Weather') return 'weather';
    return null;
  }

  private async upsertItem(marketHashName: string, group: ItemGroup): Promise<void> {
    const price = await this.steamMarket.getLowestPrice(marketHashName);
    const sortedHolds = [...group.pendingHolds].sort((a, b) => a.getTime() - b.getTime());

    const existing = await this.items.findByMarketHashName(marketHashName);
    if (existing) {
      existing.updateMarketPrice(price ?? existing.marketPrice);
      existing.updateStock(group.stock);
      existing.updatePendingHolds(sortedHolds);
      existing.updateCategory(group.category);
      await this.items.save(existing);
      return;
    }

    const id = await this.uniqueSlugFor(marketHashName);
    const item = Item.create({
      id,
      steamMarketHashName: marketHashName,
      name: group.name,
      hero: group.hero ?? undefined,
      category: group.category,
      rarity: group.rarity,
      marketPrice: price ?? 0,
      markupPercentOverride: null,
      imageUrl: group.imageUrl,
      dateAdded: new Date(),
      stock: group.stock,
      pendingHolds: sortedHolds,
      // Item nuevo (nunca visto antes): queda pendiente hasta que el admin
      // revise el precio y lo publique a mano — no sale solo al catálogo.
      published: false,
    });
    await this.items.save(item);
  }

  /**
   * Un set abierto no tiene un solo market_hash_name de Steam (cada pieza
   * tiene el suyo) — se pide el precio de cada pieza por separado y se
   * suman para el precio de referencia del set completo. El stock es el
   * mínimo entre las piezas (si tienes 2 Head pero 1 solo Weapon, solo
   * puedes armar 1 set completo).
   */
  private async upsertSetItem(setKey: string, setGroup: SetGroupAccumulator): Promise<void> {
    const pieceEntries = Array.from(setGroup.pieces.values());

    const setPieces: SetPiece[] = [];
    for (const piece of pieceEntries) {
      const price = await this.steamMarket.getLowestPrice(piece.marketHashName);
      setPieces.push({
        marketHashName: piece.marketHashName,
        name: piece.name,
        slot: piece.slot,
        imageUrl: piece.imageUrl,
        marketPrice: price ?? 0,
      });
    }

    const totalMarketPrice = setPieces.reduce((sum, p) => sum + p.marketPrice, 0);
    const stock = Math.min(...pieceEntries.map((p) => p.tradableCount));
    const pendingHolds = pieceEntries
      .flatMap((p) => p.pendingHolds)
      .sort((a, b) => a.getTime() - b.getTime());

    const syntheticKey = `${SET_KEY_PREFIX}${setKey}`;
    const existing = await this.items.findByMarketHashName(syntheticKey);
    if (existing) {
      existing.updateMarketPrice(totalMarketPrice);
      existing.updateStock(stock);
      existing.updatePendingHolds(pendingHolds);
      existing.updateSetPieces(setPieces);
      await this.items.save(existing);
      return;
    }

    const id = await this.uniqueSlugFor(setGroup.setName);
    const item = Item.create({
      id,
      steamMarketHashName: syntheticKey,
      name: setGroup.setName,
      hero: setGroup.hero,
      category: 'treasure',
      rarity: setGroup.rarity,
      marketPrice: totalMarketPrice,
      markupPercentOverride: null,
      imageUrl: pieceEntries[0]?.imageUrl,
      dateAdded: new Date(),
      stock,
      pendingHolds,
      setPieces,
      published: false,
    });
    await this.items.save(item);
  }

  /** Items que ya estaban en el catálogo pero hoy no aparecen en ninguna cuenta de almacén: quedan "agotados", no se borran solos. */
  private async markMissingItemsAsOutOfStock(seenMarketHashNames: Set<string>): Promise<void> {
    const allItems = await this.items.findAll();
    for (const item of allItems) {
      if (seenMarketHashNames.has(item.steamMarketHashName)) continue;
      if (item.stock === 0 && item.pendingHolds.length === 0) continue;
      item.updateStock(0);
      item.updatePendingHolds([]);
      await this.items.save(item);
    }
  }

  private async uniqueSlugFor(marketHashName: string): Promise<string> {
    const base = this.slugify(marketHashName);
    let candidate = base;
    let suffix = 2;
    while (await this.items.findById(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private slugify(input: string): string {
    const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(COMBINING_MARKS, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
