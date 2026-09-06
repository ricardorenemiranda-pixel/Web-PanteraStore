import { Inject, Injectable, Logger } from '@nestjs/common';
import { mapWithConcurrency } from '../../../../shared/application/concurrency';
import { ITEM_REPOSITORY, type ItemRepository } from '../../domain/ports/item.repository.port';
import {
  PRICING_CONFIG_REPOSITORY,
  type PricingConfigRepository,
} from '../../domain/ports/pricing-config.repository.port';
import {
  STEAM_MARKET_RAW_GATEWAY,
  type SteamMarketGateway,
} from '../../domain/ports/steam-market.port';
import {
  STEAM_PRICE_CACHE_REPOSITORY,
  type SteamPriceCacheRepository,
} from '../../domain/ports/steam-price-cache.repository.port';

// Steam devuelve 429 casi de inmediato con más de ~4-5 requests en paralelo
// (verificado en vivo) — ver README de este módulo.
const STEAM_MARKET_CONCURRENCY = 2;

/**
 * La única ruta de código que le pega a Steam Market en el camino "normal":
 * la dispara el cron programado (price-sync.scheduler.ts) según el
 * intervalo que configure el admin, o el botón "Sincronizar ahora". Refresca
 * el precio de TODOS los market_hash_name ya conocidos (catálogo + items de
 * inventario ya vistos antes) de una sola pasada, y los deja listos en la
 * tabla de caché para que leerlos después sea instantáneo.
 */
@Injectable()
export class SyncAllPricesUseCase {
  private readonly logger = new Logger(SyncAllPricesUseCase.name);
  private syncing = false;

  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
    @Inject(STEAM_PRICE_CACHE_REPOSITORY) private readonly priceCache: SteamPriceCacheRepository,
    @Inject(STEAM_MARKET_RAW_GATEWAY) private readonly steamMarketHttp: SteamMarketGateway,
  ) {}

  async execute(): Promise<void> {
    if (this.syncing) {
      this.logger.warn('Ya hay una sincronización en curso, se ignora este pedido.');
      return;
    }

    this.syncing = true;
    try {
      const items = await this.items.findAll();
      const knownHashNames = await this.priceCache.getAllMarketHashNames();
      const allHashNames = Array.from(
        new Set([...items.map((item) => item.steamMarketHashName), ...knownHashNames]),
      );

      this.logger.log(`Sincronizando ${allHashNames.length} precio(s) contra Steam Market...`);

      await mapWithConcurrency(allHashNames, STEAM_MARKET_CONCURRENCY, async (hashName) => {
        const price = await this.steamMarketHttp.getLowestPrice(hashName);
        await this.priceCache.set(hashName, price);
      });

      for (const item of items) {
        const cached = await this.priceCache.get(item.steamMarketHashName);
        if (cached?.price != null) {
          item.updateMarketPrice(cached.price);
          await this.items.save(item);
        }
      }

      await this.pricingConfig.setLastFullSyncAt(new Date());
      this.logger.log('Sincronización de precios completa.');
    } finally {
      this.syncing = false;
    }
  }
}
