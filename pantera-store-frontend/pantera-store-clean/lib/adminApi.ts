import { BACKEND_URL } from "./config";
import type { ItemCategory, Rarity } from "./mock-data";

export interface AdminItem {
  id: string;
  name: string;
  hero?: string;
  category: ItemCategory;
  rarity: Rarity;
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

export interface WarehouseAccount {
  id: string;
  steamId: string;
  label: string;
  addedAt: string;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

export function updateItemMarkup(itemId: string, markupPercent: number | null) {
  return request(`/items/${itemId}/markup`, {
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

export function updateItemPrice(itemId: string, price: number | null): Promise<AdminItem> {
  return request<AdminItem>(`/items/${itemId}/price`, {
    method: "PATCH",
    body: JSON.stringify({ price }),
  });
}

export function fetchWarehouseAccounts(): Promise<WarehouseAccount[]> {
  return request<WarehouseAccount[]>("/warehouse/accounts");
}

export function addWarehouseAccount(steamId: string, label: string): Promise<WarehouseAccount> {
  return request<WarehouseAccount>("/warehouse/accounts", {
    method: "POST",
    body: JSON.stringify({ steamId, label }),
  });
}

export function removeWarehouseAccount(id: string) {
  return request(`/warehouse/accounts/${id}`, { method: "DELETE" });
}

export function syncWarehouseNow() {
  return request(`/warehouse/sync`, { method: "POST" });
}

export function fetchPendingItems(): Promise<AdminItem[]> {
  return request<AdminItem[]>("/warehouse/pending-items");
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

export function approveOrder(orderId: string): Promise<AdminOrder> {
  return request<AdminOrder>(`/orders/${orderId}/approve`, { method: "PATCH" });
}

export function rejectOrder(orderId: string): Promise<AdminOrder> {
  return request<AdminOrder>(`/orders/${orderId}/reject`, { method: "PATCH" });
}
