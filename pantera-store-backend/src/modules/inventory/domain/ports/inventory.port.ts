import { Rarity } from '../../../catalog/domain/entities/item.entity';

export interface InventoryItem {
  assetId: string;
  marketHashName: string;
  name: string;
  hero: string | null;
  /** null cuando Steam no le puso tag de rareza (ej. herramientas, sets no cosméticos) */
  rarity: Rarity | null;
  imageUrl: string;
  tradable: boolean;
  marketable: boolean;
  /** Si no es tradable por estar en trade hold (regalo reciente), fecha en que se libera (si Steam la expuso). */
  tradeHoldUntil: Date | null;
  /** Tag "Type" de Steam (ej. "Courier", "Weather", "Ward") — null si no aplica. Se usa para clasificar la categoría del item. */
  typeTag: string | null;
  /** Tag "Slot" de Steam (ej. "Weapon", "Head", "Back") — "N/A" o null si no aplica (ej. cofres sin abrir). Se usa para detectar piezas de un set abierto. */
  slotTag: string | null;
}

export const INVENTORY_GATEWAY = Symbol('INVENTORY_GATEWAY');

/**
 * Puerto hacia el inventario real de Steam del usuario. La implementación
 * real lee el endpoint público de inventario de Steam (no requiere una
 * cuenta de bot — ver README.md de este módulo) — todo lo demás del
 * backend le habla a esta interfaz, no a la llamada HTTP directamente.
 */
export interface InventoryGateway {
  getDota2Inventory(steamId: string): Promise<InventoryItem[]>;
}
