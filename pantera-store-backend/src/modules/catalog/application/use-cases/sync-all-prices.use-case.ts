import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ITEM_REPOSITORY,
  type ItemRepository,
} from '../../domain/ports/item.repository.port';
import {
  PRICING_CONFIG_REPOSITORY,
  type PricingConfigRepository,
} from '../../domain/ports/pricing-config.repository.port';
import {
  STEAM_MARKET_RAW_GATEWAY,
  SteamRateLimitedException,
  type SteamMarketGateway,
} from '../../domain/ports/steam-market.port';
import {
  STEAM_PRICE_CACHE_REPOSITORY,
  type SteamPriceCacheRepository,
} from '../../domain/ports/steam-price-cache.repository.port';

// Steam aguanta ~20 consultas/minuto por IP y devuelve 429 (con bloqueo de
// unos minutos) si se le insiste. La sincronización va de a UNA, espaciada, y
// si Steam limita se enfría y reintenta después: prioriza que TODOS los items
// queden con precio, no la velocidad.
const STEAM_REQUEST_SPACING_MS = 3500;
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const MAX_PASSES = 6;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * La única ruta de código que le pega a Steam Market en el camino "normal":
 * la dispara el cron programado (price-sync.scheduler.ts) según el
 * intervalo que configure el admin, o el botón "Sincronizar ahora". Refresca
 * el precio de TODOS los market_hash_name ya conocidos (catálogo + items de
 * inventario ya vistos antes) de una sola pasada, y los deja listos en la
 * tabla de caché para que leerlos después sea instantáneo.
 */
export interface SyncAllPricesProgress {
  syncing: boolean;
  processed: number;
  total: number;
  /** true mientras espera a que Steam levante el bloqueo; el avance queda quieto y se reanuda solo. */
  waiting: boolean;
}

@Injectable()
export class SyncAllPricesUseCase {
  private readonly logger = new Logger(SyncAllPricesUseCase.name);
  private syncing = false;
  private processed = 0;
  private total = 0;
  private waiting = false;

  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
    @Inject(PRICING_CONFIG_REPOSITORY)
    private readonly pricingConfig: PricingConfigRepository,
    @Inject(STEAM_PRICE_CACHE_REPOSITORY)
    private readonly priceCache: SteamPriceCacheRepository,
    @Inject(STEAM_MARKET_RAW_GATEWAY)
    private readonly steamMarketHttp: SteamMarketGateway,
  ) {}

  /** Consultado por el frontend mientras espera, para mostrar un % real de avance. */
  getProgress(): SyncAllPricesProgress {
    return {
      syncing: this.syncing,
      processed: this.processed,
      total: this.total,
      waiting: this.waiting,
    };
  }

  async execute(): Promise<void> {
    if (this.syncing) {
      this.logger.warn(
        'Ya hay una sincronización en curso, se ignora este pedido.',
      );
      return;
    }

    this.syncing = true;
    this.processed = 0;
    this.total = 0;
    try {
      const items = await this.items.findAll();
      const knownHashNames = await this.priceCache.getAllMarketHashNames();
      const itemHashNames = items
        .map((item) => item.steamMarketHashName)
        .filter((hashName): hashName is string => Boolean(hashName));
      const allHashNames = Array.from(
        new Set([...itemHashNames, ...knownHashNames]),
      );
      this.total = allHashNames.length;

      this.logger.log(
        `Sincronizando ${allHashNames.length} precio(s) contra Steam Market...`,
      );

      let pending = allHashNames;
      for (let pass = 1; pending.length > 0 && pass <= MAX_PASSES; pass += 1) {
        if (pass > 1) {
          this.logger.log(
            `Pasada ${pass}: reintentando ${pending.length} precio(s) que Steam había limitado.`,
          );
        }
        const limited: string[] = [];
        for (const hashName of pending) {
          try {
            const price = await this.steamMarketHttp.getLowestPrice(hashName);
            await this.storePrice(hashName, price);
            this.processed += 1;
            await delay(STEAM_REQUEST_SPACING_MS);
          } catch (error) {
            if (!(error instanceof SteamRateLimitedException)) throw error;
            limited.push(hashName);
            this.waiting = true;
            await delay(RATE_LIMIT_COOLDOWN_MS);
            this.waiting = false;
          }
        }
        pending = limited;
      }
      if (pending.length > 0) {
        this.logger.warn(
          `${pending.length} precio(s) quedaron sin actualizar (Steam siguió limitando). Conservan su último precio.`,
        );
      }

      for (const item of items) {
        if (!item.steamMarketHashName) continue;
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
      this.waiting = false;
    }
  }

  /** Un "sin precio" nuevo no pisa un precio bueno que ya estaba guardado. */
  private async storePrice(
    hashName: string,
    price: number | null,
  ): Promise<void> {
    if (price === null) {
      const existing = await this.priceCache.get(hashName);
      if (existing?.price != null) return;
    }
    await this.priceCache.set(hashName, price);
  }
}
