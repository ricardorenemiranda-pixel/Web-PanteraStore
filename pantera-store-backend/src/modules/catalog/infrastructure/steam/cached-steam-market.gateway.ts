import { Inject, Injectable } from '@nestjs/common';
import {
  STEAM_MARKET_RAW_GATEWAY,
  SteamRateLimitedException,
  type SteamMarketGateway,
} from '../../domain/ports/steam-market.port';
import {
  STEAM_PRICE_CACHE_REPOSITORY,
  type SteamPriceCacheRepository,
} from '../../domain/ports/steam-price-cache.repository.port';

/**
 * Lo que de verdad se inyecta como STEAM_MARKET_GATEWAY en toda la app.
 * Nunca le pega a Steam en el camino normal de un usuario navegando: si el
 * item ya está en la tabla de precios, se devuelve directo (sin importar
 * cuán vieja sea esa fila — mantenerla fresca es trabajo exclusivo del job
 * de sincronización, ver price-sync.scheduler.ts). Si es la primera vez que
 * se ve ese market_hash_name (ej. un item de inventario que nadie había
 * escaneado antes), se pide una vez a Steam y se guarda — así no se queda
 * "sin precio" toda la semana esperando el próximo sync.
 */
@Injectable()
export class CachedSteamMarketGateway implements SteamMarketGateway {
  constructor(
    @Inject(STEAM_MARKET_RAW_GATEWAY) private readonly httpGateway: SteamMarketGateway,
    @Inject(STEAM_PRICE_CACHE_REPOSITORY) private readonly cache: SteamPriceCacheRepository,
  ) {}

  async getLowestPrice(marketHashName: string): Promise<number | null> {
    const cached = await this.cache.get(marketHashName);
    if (cached) {
      return cached.price;
    }

    try {
      const price = await this.httpGateway.getLowestPrice(marketHashName);
      await this.cache.set(marketHashName, price);
      return price;
    } catch (error) {
      // Rate limit: se responde "sin precio por ahora" pero NO se guarda en la
      // caché, así el próximo sync sí lo intenta en vez de quedar en null.
      if (error instanceof SteamRateLimitedException) return null;
      throw error;
    }
  }
}
