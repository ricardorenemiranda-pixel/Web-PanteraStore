import type { InventoryItem } from './inventory.port';

export const USER_INVENTORY_CACHE_REPOSITORY = Symbol('USER_INVENTORY_CACHE_REPOSITORY');

export interface CachedUserInventory {
  items: InventoryItem[];
  scannedAt: Date;
}

/**
 * El escaneo crudo del inventario de Steam de un usuario (todo excepto
 * precio), guardado para no tener que volver a leer el endpoint de
 * inventario de Steam cada vez que el usuario entra a "Vender mis items" —
 * se reutiliza hasta el próximo ciclo de sync o hasta que el usuario le dé
 * "Actualizar inventario" a mano.
 */
export interface UserInventoryCacheRepository {
  get(steamId: string): Promise<CachedUserInventory | null>;
  set(steamId: string, items: InventoryItem[]): Promise<void>;
}
