import { BACKEND_URL } from "./config";
import type { ItemCategory, Rarity } from "./mock-data";

export interface AdminItem {
  id: string;
  /** Código corto para ubicar el item rápido (ej. cuando un cliente escribe por WhatsApp). */
  referenceCode: string;
  name: string;
  hero?: string;
  category: ItemCategory;
  rarity: Rarity;
  description?: string;
  steamMarketHashName?: string;
  marketPrice: number;
  price: number;
  buybackPrice: number;
  markupPercentOverride: number | null;
  manualPriceOverride: number | null;
  imageUrl?: string;
  dateAdded: string;
  stock: number;
  pendingHolds: string[];
  published: boolean;
}

export interface ItemFormInput {
  name: string;
  hero?: string;
  category: ItemCategory;
  rarity: Rarity;
  description?: string;
  imageUrl?: string;
  steamMarketHashName?: string;
  marketPrice: number;
  stock: number;
  published: boolean;
}

export interface AdminOrderLineItem {
  itemId: string;
  itemName: string;
  price: number;
}

export interface AdminOrder {
  id: string;
  userDisplayName: string;
  tradeUrl: string;
  lineItems: AdminOrderLineItem[];
  total: number;
  status: "pendiente" | "procesado" | "rechazado";
  createdAt: string;
}

export type SellableRarity = "mythical" | "legendary" | "immortal" | "arcana";

export interface PricingConfig {
  globalMarkupPercent: number;
  buybackDiscountPercent: number;
  rarityMarkups: Record<SellableRarity, number | null>;
  syncIntervalDays: number;
  lastFullSyncAt: string | null;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function fetchItems(): Promise<AdminItem[]> {
  return request<AdminItem[]>("/items");
}

export function fetchOrders(): Promise<AdminOrder[]> {
  return request<AdminOrder[]>("/orders");
}

export function updateItemMarkup(itemId: string, markupPercent: number | null): Promise<AdminItem> {
  return request<AdminItem>(`/items/${itemId}/markup`, {
    method: "PATCH",
    body: JSON.stringify({ markupPercent }),
  });
}

export function updateGlobalMarkup(markupPercent: number) {
  return request(`/items/config/global-markup`, {
    method: "PATCH",
    body: JSON.stringify({ markupPercent }),
  });
}

export function syncItemPrice(itemId: string): Promise<AdminItem> {
  return request<AdminItem>(`/items/${itemId}/sync-price`, { method: "PATCH" });
}

/** Cotiza un item por su nombre exacto de Steam Market, sin que exista todavía en el catálogo. */
export function fetchSteamQuote(name: string): Promise<{ marketPrice: number | null }> {
  return request<{ marketPrice: number | null }>(
    `/items/config/steam-quote?name=${encodeURIComponent(name)}`,
  );
}

export function updateItemPrice(itemId: string, price: number | null): Promise<AdminItem> {
  return request<AdminItem>(`/items/${itemId}/price`, {
    method: "PATCH",
    body: JSON.stringify({ price }),
  });
}

/** Todo el catálogo (publicado o no) — a diferencia de fetchItems(), que solo trae lo público. */
export function fetchAllItemsAdmin(): Promise<AdminItem[]> {
  return request<AdminItem[]>("/items/admin");
}

export function createItem(data: Omit<ItemFormInput, "published">): Promise<AdminItem> {
  return request<AdminItem>("/items", { method: "POST", body: JSON.stringify(data) });
}

export function updateItem(itemId: string, data: Partial<ItemFormInput>): Promise<AdminItem> {
  return request<AdminItem>(`/items/${itemId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteItem(itemId: string): Promise<{ ok: true }> {
  return request(`/items/${itemId}`, { method: "DELETE" });
}

export function publishItem(itemId: string): Promise<AdminItem> {
  return request<AdminItem>(`/items/${itemId}/publish`, { method: "PATCH" });
}

export function fetchPricingConfig(): Promise<PricingConfig> {
  return request<PricingConfig>("/items/config");
}

export function updateRarityMarkup(rarity: SellableRarity, markupPercent: number | null) {
  return request(`/items/config/rarity-markup`, {
    method: "PATCH",
    body: JSON.stringify({ rarity, markupPercent }),
  });
}

export function updateSyncInterval(days: number) {
  return request(`/items/config/sync-interval`, {
    method: "PATCH",
    body: JSON.stringify({ days }),
  });
}

export function syncPricesNow() {
  return request(`/items/config/sync-now`, { method: "POST" });
}

export interface SyncStatus {
  syncing: boolean;
  processed: number;
  total: number;
  waiting: boolean;
}

/** Se consulta en loop mientras dura la sincronización, para mostrar el % real de avance. */
export function fetchSyncStatus(): Promise<SyncStatus> {
  return request<SyncStatus>(`/items/config/sync-status`);
}

export function approveOrder(orderId: string): Promise<AdminOrder> {
  return request<AdminOrder>(`/orders/${orderId}/approve`, { method: "PATCH" });
}

export function rejectOrder(orderId: string): Promise<AdminOrder> {
  return request<AdminOrder>(`/orders/${orderId}/reject`, { method: "PATCH" });
}
