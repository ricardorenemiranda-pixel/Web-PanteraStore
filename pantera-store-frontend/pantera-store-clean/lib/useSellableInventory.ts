"use client";

import { useCallback, useEffect, useState } from "react";
import { BACKEND_URL } from "./config";
import type { Rarity } from "./mock-data";

export interface SellableInventoryItem {
  assetId: string;
  marketHashName: string;
  name: string;
  hero: string | null;
  rarity: Rarity;
  imageUrl: string;
  /** null si Steam Market no tiene precio de referencia para este item ahora mismo */
  buybackPrice: number | null;
}

export type InventoryStatus = "loading" | "unauthenticated" | "ready" | "error" | "rate-limited";

/** Trae el inventario real (ya filtrado a lo vendible) del usuario logueado con Steam. */
export function useSellableInventory() {
  const [items, setItems] = useState<SellableInventoryItem[]>([]);
  const [status, setStatus] = useState<InventoryStatus>("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setStatus("loading");
    }

    try {
      const url = `${BACKEND_URL}/inventory/me${forceRefresh ? "?refresh=true" : ""}`;
      const res = await fetch(url, { credentials: "include" });

      if (res.status === 401) {
        setStatus("unauthenticated");
        return;
      }
      if (res.status === 503) {
        // Steam Market/inventario está rate-limiteando ahora mismo.
        setStatus("rate-limited");
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as SellableInventoryItem[];
      setItems(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return { items, status, refreshing, refresh: () => load(true) };
}
