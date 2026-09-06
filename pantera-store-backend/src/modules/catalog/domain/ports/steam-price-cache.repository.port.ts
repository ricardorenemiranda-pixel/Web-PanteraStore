export const STEAM_PRICE_CACHE_REPOSITORY = Symbol('STEAM_PRICE_CACHE_REPOSITORY');

export interface SteamPriceCacheEntry {
  marketHashName: string;
  /** null si Steam Market no tenía referencia de precio la última vez que se consultó. */
  price: number | null;
  lastSyncedAt: Date;
}

/**
 * Precio de cada item, ya consultado a Steam Market una vez y compartido
 * entre todos los usuarios/items iguales — leer de acá nunca le pega a
 * Steam. Solo el job de sincronización (o el botón "Sincronizar ahora" del
 * admin) escribe acá.
 */
export interface SteamPriceCacheRepository {
  get(marketHashName: string): Promise<SteamPriceCacheEntry | null>;
  set(marketHashName: string, price: number | null): Promise<void>;
  /** Todos los market_hash_name ya vistos (catálogo + items de inventario ya consultados). */
  getAllMarketHashNames(): Promise<string[]>;
}
