import { BACKEND_URL } from "./config";
import type { ItemCategory, Rarity } from "./mock-data";

export interface CatalogSetPiece {
  name: string;
  slot: string;
  imageUrl: string;
  price: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  hero?: string;
  category: ItemCategory;
  rarity: Rarity;
  marketPrice: number;
  price: number;
  buybackPrice: number;
  imageUrl?: string;
  dateAdded: string;
  stock: number;
  /** Fechas ISO en que se liberan copias que hoy están en trade hold (vacío = nada pendiente), ya ordenadas. */
  pendingHolds: string[];
  /** Piezas de un set abierto (categoría "treasure"). Vacío para cofres cerrados e ítems normales. */
  setPieces: CatalogSetPiece[];
}

// La empresa solo publica en la tienda items de estas 4 rarezas — mismo
// criterio que "vender mis items". El resto (común, poco común, raro,
// anciano) puede existir en el almacén/admin pero no se muestra al público.
const SELLABLE_RARITIES: Rarity[] = ["mythical", "legendary", "immortal", "arcana"];

function isSellable(item: CatalogItem): boolean {
  // Los cofres/sets (categoría "treasure") se muestran sin importar su
  // rareza: la mayoría son "Rare", no Mítico+ como el resto del catálogo.
  return SELLABLE_RARITIES.includes(item.rarity) || item.category === "treasure";
}

export function fetchCatalogItems(): Promise<CatalogItem[]> {
  return fetch(`${BACKEND_URL}/items`, { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (res.json() as Promise<CatalogItem[]>).then((items) => items.filter(isSellable));
  });
}

export function fetchCatalogItem(id: string): Promise<CatalogItem | null> {
  return fetch(`${BACKEND_URL}/items/${id}`, { cache: "no-store" }).then((res) => {
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (res.json() as Promise<CatalogItem>).then((item) => (isSellable(item) ? item : null));
  });
}
