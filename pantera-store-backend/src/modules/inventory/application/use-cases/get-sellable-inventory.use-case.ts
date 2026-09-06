import { Inject, Injectable } from '@nestjs/common';
import { mapWithConcurrency } from '../../../../shared/application/concurrency';
import { Rarity } from '../../../catalog/domain/entities/item.entity';
import { resolveMarkupPercent } from '../../../catalog/application/resolve-markup-percent';
import {
  PRICING_CONFIG_REPOSITORY,
  type PricingConfigRepository,
} from '../../../catalog/domain/ports/pricing-config.repository.port';
import {
  STEAM_MARKET_GATEWAY,
  type SteamMarketGateway,
} from '../../../catalog/domain/ports/steam-market.port';
import {
  INVENTORY_GATEWAY,
  type InventoryGateway,
  type InventoryItem,
} from '../../domain/ports/inventory.port';
import {
  USER_INVENTORY_CACHE_REPOSITORY,
  type UserInventoryCacheRepository,
} from '../../domain/ports/user-inventory-cache.repository.port';
import { SellableInventoryItem } from '../dto/sellable-inventory-item.dto';

// La empresa solo compra items de estas 4 rarezas — mismo criterio que el
// filtro de "Rareza" del catálogo público (app/catalogo/page.tsx).
const SELLABLE_RARITIES: Rarity[] = ['mythical', 'legendary', 'immortal', 'arcana'];

// Cuántas consultas a Steam Market se disparan en paralelo. Con la tabla de
// precios compartida (STEAM_MARKET_GATEWAY = CachedSteamMarketGateway) esto
// casi nunca le pega de verdad a Steam — solo la primera vez que se ve un
// item — pero se mantiene el límite por las dudas.
const STEAM_MARKET_CONCURRENCY = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Trae el inventario real de Dota 2 del usuario. El escaneo crudo (Steam) se
 * cachea por steamId y se reutiliza hasta que pase el intervalo de
 * sincronización configurado por el admin (mismo intervalo que el de
 * precios) o hasta que el usuario pida "Actualizar inventario" a mano — así
 * un usuario navegando nunca vuelve a disparar una petición al inventario de
 * Steam en el camino normal. El precio de cada item vendible sí se resuelve
 * siempre en vivo contra la tabla de precios (barata: ver
 * CachedSteamMarketGateway), para que un cambio de markup a mitad de semana
 * se vea al instante sin esperar el próximo sync.
 */
@Injectable()
export class GetSellableInventoryUseCase {
  constructor(
    @Inject(INVENTORY_GATEWAY) private readonly inventory: InventoryGateway,
    @Inject(STEAM_MARKET_GATEWAY) private readonly steamMarket: SteamMarketGateway,
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
    @Inject(USER_INVENTORY_CACHE_REPOSITORY)
    private readonly inventoryCache: UserInventoryCacheRepository,
  ) {}

  async execute(steamId: string, forceRefresh = false): Promise<SellableInventoryItem[]> {
    const rawItems = await this.getRawInventory(steamId, forceRefresh);
    return this.priceSellableItems(rawItems);
  }

  private async getRawInventory(steamId: string, forceRefresh: boolean): Promise<InventoryItem[]> {
    if (!forceRefresh) {
      const cached = await this.inventoryCache.get(steamId);
      if (cached) {
        const syncIntervalDays = await this.pricingConfig.getSyncIntervalDays();
        const staleAt = cached.scannedAt.getTime() + syncIntervalDays * DAY_MS;
        if (Date.now() < staleAt) {
          return cached.items;
        }
      }
    }

    const items = await this.inventory.getDota2Inventory(steamId);
    await this.inventoryCache.set(steamId, items);
    return items;
  }

  private async priceSellableItems(items: InventoryItem[]): Promise<SellableInventoryItem[]> {
    const sellable = items.filter(
      (item) => item.tradable && item.rarity !== null && SELLABLE_RARITIES.includes(item.rarity),
    );

    const [globalMarkup, buybackDiscount, rarityMarkups] = await Promise.all([
      this.pricingConfig.getGlobalMarkupPercent(),
      this.pricingConfig.getBuybackDiscountPercent(),
      this.pricingConfig.getAllRarityMarkups(),
    ]);

    return mapWithConcurrency(sellable, STEAM_MARKET_CONCURRENCY, async (item): Promise<SellableInventoryItem> => {
      const marketPrice = await this.steamMarket.getLowestPrice(item.marketHashName);
      const markup = resolveMarkupPercent(item.rarity as Rarity, rarityMarkups, globalMarkup);
      const buybackPrice =
        marketPrice === null
          ? null
          : this.roundToCents(marketPrice * (1 + markup / 100) * (1 - buybackDiscount / 100));

      return {
        assetId: item.assetId,
        marketHashName: item.marketHashName,
        name: item.name,
        hero: item.hero,
        rarity: item.rarity as Rarity,
        imageUrl: item.imageUrl,
        buybackPrice,
      };
    });
  }

  private roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
