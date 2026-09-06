import { Item, ItemCategory, Rarity } from '../entities/item.entity';

export interface ItemFilter {
  category?: ItemCategory;
  rarity?: Rarity;
  hero?: string;
  published?: boolean;
}

/**
 * Token de inyección del puerto. Se inyecta por Symbol (no por clase) para
 * que el dominio/aplicación nunca dependan de una implementación concreta
 * (Postgres, en memoria, lo que sea) — ver infrastructure/persistence.
 */
export const ITEM_REPOSITORY = Symbol('ITEM_REPOSITORY');

export interface ItemRepository {
  findAll(filter?: ItemFilter): Promise<Item[]>;
  findById(id: string): Promise<Item | null>;
  /** Busca un item por su market_hash_name real de Steam (para el upsert del sync de almacén). */
  findByMarketHashName(marketHashName: string): Promise<Item | null>;
  save(item: Item): Promise<void>;
}
