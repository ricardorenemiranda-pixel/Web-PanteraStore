"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import { useAuth } from "@/lib/AuthContext";
import {
  addWarehouseAccount,
  AdminItem,
  AdminOrder,
  approveOrder,
  fetchItems,
  fetchOrders,
  fetchPendingItems,
  fetchPricingConfig,
  fetchWarehouseAccounts,
  PricingConfig,
  publishItem,
  rejectOrder,
  removeWarehouseAccount,
  SellableRarity,
  syncItemPrice,
  syncPricesNow,
  syncWarehouseNow,
  updateGlobalMarkup,
  updateItemMarkup,
  updateItemPrice,
  updateRarityMarkup,
  updateSyncInterval,
  WarehouseAccount,
} from "@/lib/adminApi";
import { ALL_HERO_NAMES, CATEGORY_LABEL, ItemCategory, RARITY_LABEL, Rarity } from "@/lib/mock-data";
import { formatPEN } from "@/lib/currency";

type Tab = "prices" | "warehouse" | "orders" | "analytics";

const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL) as ItemCategory[];
// Solo las rarezas que la empresa compra/vende — mismo criterio que el filtro público de /catalogo.
const FILTERABLE_RARITIES: Rarity[] = ["mythical", "legendary", "immortal", "arcana"];

const statusLabel: Record<AdminOrder["status"], string> = {
  pendiente: "Pendiente",
  procesado: "Procesado",
  rechazado: "Rechazado",
};
const statusClass: Record<AdminOrder["status"], string> = {
  pendiente: "bg-secondary/10 text-secondary border border-secondary/20",
  procesado: "bg-surface-container-highest text-on-surface-variant border border-white/10",
  rechazado: "bg-error/10 text-error border border-error/20",
};

const SELLABLE_RARITIES: SellableRarity[] = ["mythical", "legendary", "immortal", "arcana"];

function emptyRarityInputs(): Record<SellableRarity, string> {
  return { mythical: "", legendary: "", immortal: "", arcana: "" };
}

export default function AdminPage() {
  const { user, loading: userLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("prices");

  const [items, setItems] = useState<AdminItem[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [globalMarkupInput, setGlobalMarkupInput] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [rarityInputs, setRarityInputs] = useState<Record<SellableRarity, string>>(emptyRarityInputs());
  const [syncIntervalInput, setSyncIntervalInput] = useState("");
  const [savingRarity, setSavingRarity] = useState<SellableRarity | null>(null);
  const [savingInterval, setSavingInterval] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const [accounts, setAccounts] = useState<WarehouseAccount[]>([]);
  const [newAccountSteamId, setNewAccountSteamId] = useState("");
  const [newAccountLabel, setNewAccountLabel] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(null);
  const [syncingWarehouse, setSyncingWarehouse] = useState(false);
  const [warehouseMessage, setWarehouseMessage] = useState("");
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [unpublishedItems, setUnpublishedItems] = useState<AdminItem[]>([]);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [filterHero, setFilterHero] = useState("");
  const [filterCategory, setFilterCategory] = useState<ItemCategory | "">("");
  const [filterRarity, setFilterRarity] = useState<Rarity | "">("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    setDataLoading(true);
    Promise.all([
      fetchItems(),
      fetchOrders(),
      fetchPricingConfig(),
      fetchWarehouseAccounts(),
      fetchPendingItems(),
    ])
      .then(([itemsData, ordersData, configData, accountsData, pendingData]) => {
        setItems(itemsData);
        setOrders(ordersData);
        setConfig(configData);
        setAccounts(accountsData);
        setUnpublishedItems(pendingData);
        setRarityInputs({
          mythical: configData.rarityMarkups.mythical?.toString() ?? "",
          legendary: configData.rarityMarkups.legendary?.toString() ?? "",
          immortal: configData.rarityMarkups.immortal?.toString() ?? "",
          arcana: configData.rarityMarkups.arcana?.toString() ?? "",
        });
        setSyncIntervalInput(configData.syncIntervalDays.toString());
      })
      .catch(() => setError("No pudimos cargar los datos del panel."))
      .finally(() => setDataLoading(false));
  }, [isAdmin]);

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newAccountSteamId.trim() || !newAccountLabel.trim()) return;
    setAddingAccount(true);
    try {
      const account = await addWarehouseAccount(newAccountSteamId.trim(), newAccountLabel.trim());
      setAccounts((prev) => [...prev, account]);
      setNewAccountSteamId("");
      setNewAccountLabel("");
    } catch {
      setError("No se pudo agregar la cuenta (revisa que el SteamID64 sea válido).");
    } finally {
      setAddingAccount(false);
    }
  }

  async function handleRemoveAccount(id: string) {
    setRemovingAccountId(id);
    try {
      await removeWarehouseAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError("No se pudo quitar la cuenta.");
    } finally {
      setRemovingAccountId(null);
    }
  }

  async function handleSyncWarehouse() {
    setSyncingWarehouse(true);
    setWarehouseMessage("");
    try {
      await syncWarehouseNow();
      setWarehouseMessage("Sincronización de almacén disparada — el catálogo se irá actualizando.");
      const [refreshedItems, refreshedPending] = await Promise.all([fetchItems(), fetchPendingItems()]);
      setItems(refreshedItems);
      setUnpublishedItems(refreshedPending);
    } catch {
      setError("No se pudo sincronizar el almacén.");
    } finally {
      setSyncingWarehouse(false);
    }
  }

  /** El item puede estar en la lista de publicados o en la de pendientes — actualiza la que corresponda. */
  function applyItemUpdate(updated: AdminItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setUnpublishedItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  async function handlePriceSave(itemId: string) {
    const raw = priceInputs[itemId];
    const price = raw === undefined || raw.trim() === "" ? null : Number(raw);
    if (price !== null && Number.isNaN(price)) return;
    setSavingPriceId(itemId);
    try {
      const updated = await updateItemPrice(itemId, price);
      applyItemUpdate(updated);
    } catch {
      setError("No se pudo actualizar el precio de ese item.");
    } finally {
      setSavingPriceId(null);
    }
  }

  async function handleConsultPrice(itemId: string) {
    setSyncingId(itemId);
    try {
      const updated = await syncItemPrice(itemId);
      applyItemUpdate(updated);
    } catch {
      setError("No se pudo consultar el precio en Steam Market.");
    } finally {
      setSyncingId(null);
    }
  }

  async function handlePublish(itemId: string) {
    setPublishingId(itemId);
    try {
      const updated = await publishItem(itemId);
      setUnpublishedItems((prev) => prev.filter((i) => i.id !== itemId));
      setItems((prev) => [...prev, updated]);
    } catch {
      setError("No se pudo publicar el item.");
    } finally {
      setPublishingId(null);
    }
  }

  const filteredWarehouseItems = useMemo(() => {
    return items.filter((item) => {
      // Solo se gestionan acá las rarezas que la empresa realmente vende —
      // mismo criterio que el catálogo público. Los cofres/sets (categoría
      // "treasure") se muestran sin importar su rareza (la mayoría son "Rare").
      if (!FILTERABLE_RARITIES.includes(item.rarity) && item.category !== "treasure") return false;
      if (filterHero && item.hero !== filterHero) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterRarity && item.rarity !== filterRarity) return false;
      return true;
    });
  }, [items, filterHero, filterCategory, filterRarity]);

  const recentPendingItems = useMemo(
    () => items.filter((item) => item.pendingHolds.length > 0),
    [items],
  );

  async function handleRarityMarkupSave(rarity: SellableRarity) {
    const raw = rarityInputs[rarity];
    const percent = raw.trim() === "" ? null : Number(raw);
    if (percent !== null && Number.isNaN(percent)) return;
    setSavingRarity(rarity);
    try {
      await updateRarityMarkup(rarity, percent);
      setConfig((prev) => (prev ? { ...prev, rarityMarkups: { ...prev.rarityMarkups, [rarity]: percent } } : prev));
    } catch {
      setError(`No se pudo actualizar el markup de ${RARITY_LABEL[rarity]}.`);
    } finally {
      setSavingRarity(null);
    }
  }

  async function handleSyncIntervalSave() {
    const days = Number(syncIntervalInput);
    if (Number.isNaN(days) || days < 1) return;
    setSavingInterval(true);
    try {
      await updateSyncInterval(days);
      setConfig((prev) => (prev ? { ...prev, syncIntervalDays: days } : prev));
    } catch {
      setError("No se pudo actualizar el intervalo de sincronización.");
    } finally {
      setSavingInterval(false);
    }
  }

  async function handleSyncNow() {
    setSyncingNow(true);
    setSyncMessage("");
    try {
      await syncPricesNow();
      setSyncMessage("Sincronización disparada — los precios se irán actualizando en segundo plano.");
      const refreshed = await fetchItems();
      setItems(refreshed);
    } catch {
      setError("No se pudo disparar la sincronización.");
    } finally {
      setSyncingNow(false);
    }
  }

  async function handleMarkupChange(itemId: string, value: string) {
    const percent = value === "" ? null : Number(value);
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, markupPercentOverride: percent } : item))
    );
    if (percent === null || Number.isNaN(percent)) return;
    try {
      await updateItemMarkup(itemId, percent);
    } catch {
      setError(`No se pudo actualizar el markup de ese item.`);
    }
  }

  async function handleSyncPrice(itemId: string) {
    setSyncingId(itemId);
    try {
      const updated = await syncItemPrice(itemId);
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
    } catch {
      setError("No se pudo sincronizar el precio con Steam Market.");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleGlobalMarkup() {
    const percent = Number(globalMarkupInput);
    if (Number.isNaN(percent)) return;
    try {
      await updateGlobalMarkup(percent);
      const refreshed = await fetchItems();
      setItems(refreshed);
    } catch {
      setError("No se pudo actualizar el markup global.");
    }
  }

  async function handleOrderAction(orderId: string, action: "approve" | "reject") {
    try {
      const updated = action === "approve" ? await approveOrder(orderId) : await rejectOrder(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch {
      setError("No se pudo actualizar la orden.");
    }
  }

  const pendingCount = orders.filter((o) => o.status === "pendiente").length;
  const catalogValue = items.reduce((sum, item) => sum + item.price, 0);
  const avgMarkup =
    items.length === 0
      ? 0
      : items.reduce((sum, item) => sum + (item.price / item.marketPrice - 1) * 100, 0) / items.length;

  if (userLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">Inicia sesión para continuar.</p>
          <Link href="/login" className="text-primary underline">
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant">
            Tu cuenta ({user.displayName}) no tiene permisos de administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background font-body-md selection:bg-primary selection:text-on-primary">
      {/* Header simple de admin */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 bg-surface/80 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <Link
          href="/"
          className="font-headline-md text-headline-md font-bold text-primary tracking-tighter"
        >
          PANTERASTORE
        </Link>
        <div className="flex items-center gap-base">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
            Modo Administrador · {user.displayName}
          </span>
        </div>
      </header>

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col h-full w-64 fixed left-0 pt-20 bg-surface-container border-r border-white/5">
          <div className="px-6 py-4 border-b border-white/5 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center border border-white/10">
                <span className="material-symbols-outlined text-primary">admin_panel_settings</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-primary">Panel Admin</h3>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-label-caps">
                  Gestión de Mercado
                </p>
              </div>
            </div>
          </div>
          <nav className="flex flex-col">
            {[
              { id: "prices" as Tab, label: "Precios", icon: "payments" },
              { id: "warehouse" as Tab, label: "Almacén", icon: "inventory_2" },
              { id: "orders" as Tab, label: "Órdenes", icon: "shopping_cart" },
              { id: "analytics" as Tab, label: "Analítica", icon: "analytics" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  tab === t.id
                    ? "group flex items-center gap-3 px-6 py-4 text-secondary border-r-2 border-secondary bg-secondary/5 transition-all duration-150"
                    : "group flex items-center gap-3 px-6 py-4 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors"
                }
              >
                <span className="material-symbols-outlined">{t.icon}</span>
                <span className="font-label-caps text-label-caps uppercase">{t.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Contenido */}
        <main className="flex-1 lg:pl-64 pt-16 pb-24 lg:pb-0 min-h-screen bg-surface">
          <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-12">
            {error && (
              <div className="mb-6 bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">
                {error}
              </div>
            )}

            {dataLoading && <p className="text-on-surface-variant">Cargando...</p>}

            {!dataLoading && tab === "prices" && (
              <section className="space-y-gutter">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h1 className="font-headline-lg text-headline-lg text-on-surface">
                      Gestión de Precios
                    </h1>
                    <p className="font-body-md text-on-surface-variant">
                      Configura el margen sobre cada item y monitorea el valor del catálogo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="bg-surface-container-low border border-white/10 text-on-surface font-body-sm py-2 px-3 w-24"
                      type="number"
                      step="0.1"
                      placeholder="Markup %"
                      value={globalMarkupInput}
                      onChange={(e) => setGlobalMarkupInput(e.target.value)}
                    />
                    <button
                      onClick={handleGlobalMarkup}
                      className="bg-secondary text-on-secondary px-4 py-2 font-label-caps text-label-caps hover:brightness-110 transition-all"
                    >
                      Aplicar markup global
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                  <div className="glass-panel p-6 flex flex-col justify-between">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                      Margen Promedio
                    </span>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-headline-xl text-headline-xl text-secondary">
                        {avgMarkup.toFixed(1)}%
                      </span>
                      <span className="text-on-surface-variant font-body-sm">en todo el catálogo</span>
                    </div>
                  </div>
                  <div className="glass-panel p-6 flex flex-col justify-between">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                      Valor del Catálogo
                    </span>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-headline-xl text-headline-xl text-on-surface">
                        {formatPEN(catalogValue)}
                      </span>
                      <span className="text-on-surface-variant font-body-sm">potencial total</span>
                    </div>
                  </div>
                  <div className="glass-panel p-6 flex flex-col justify-between border-l-4 border-l-primary">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                      Estado de la API
                    </span>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="font-headline-md text-headline-md text-primary">En vivo</span>
                    </div>
                  </div>
                </div>

                {config && (
                  <div className="glass-panel p-6">
                    <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
                      Sincronización con Steam Market
                    </h2>
                    <p className="font-body-sm text-on-surface-variant mb-6">
                      La empresa controla cada cuánto se le pide precios a Steam — mientras tanto, todos
                      los usuarios comparten el mismo precio ya guardado. Nunca se le pega a Steam en el
                      camino de un usuario navegando.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-6">
                      {SELLABLE_RARITIES.map((rarity) => (
                        <div key={rarity} className="flex items-center gap-2">
                          <label className="font-label-caps text-label-caps text-on-surface-variant uppercase w-24 shrink-0">
                            {RARITY_LABEL[rarity]}
                          </label>
                          <input
                            className="bg-surface border border-white/10 text-on-surface font-body-sm w-24 py-2 px-3 focus:ring-1 focus:ring-secondary focus:outline-none"
                            type="number"
                            step="0.1"
                            placeholder="global"
                            value={rarityInputs[rarity]}
                            onChange={(e) =>
                              setRarityInputs((prev) => ({ ...prev, [rarity]: e.target.value }))
                            }
                          />
                          <button
                            onClick={() => handleRarityMarkupSave(rarity)}
                            disabled={savingRarity === rarity}
                            className="bg-secondary text-on-secondary px-3 py-2 font-label-caps text-[10px] hover:brightness-110 transition-all disabled:opacity-50"
                          >
                            {savingRarity === rarity ? "..." : "Guardar"}
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                          Sincronizar cada
                        </label>
                        <input
                          className="bg-surface border border-white/10 text-on-surface font-body-sm w-16 py-2 px-3 focus:ring-1 focus:ring-secondary focus:outline-none"
                          type="number"
                          min={1}
                          value={syncIntervalInput}
                          onChange={(e) => setSyncIntervalInput(e.target.value)}
                        />
                        <span className="font-body-sm text-on-surface-variant">días</span>
                        <button
                          onClick={handleSyncIntervalSave}
                          disabled={savingInterval}
                          className="bg-secondary text-on-secondary px-3 py-2 font-label-caps text-[10px] hover:brightness-110 transition-all disabled:opacity-50"
                        >
                          {savingInterval ? "..." : "Guardar"}
                        </button>
                      </div>

                      <button
                        onClick={handleSyncNow}
                        disabled={syncingNow}
                        className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 font-label-caps text-[10px] hover:brightness-110 transition-all disabled:opacity-50"
                      >
                        <span className={`material-symbols-outlined text-sm ${syncingNow ? "animate-spin" : ""}`}>
                          sync
                        </span>
                        {syncingNow ? "Sincronizando..." : "Sincronizar ahora"}
                      </button>

                      {config.lastFullSyncAt && (
                        <span className="font-body-sm text-on-surface-variant">
                          Último sync: {new Date(config.lastFullSyncAt).toLocaleString("es-PE")}
                        </span>
                      )}
                    </div>

                    {syncMessage && <p className="font-body-sm text-primary mt-4">{syncMessage}</p>}
                  </div>
                )}

                <div className="overflow-x-auto glass-panel">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-white/10">
                        <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                          Item
                        </th>
                        <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                          Precio Steam
                        </th>
                        <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                          Markup (%)
                        </th>
                        <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                          Precio Final
                        </th>
                        <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-surface-container-highest border border-white/10 p-1">
                                <ImagePlaceholder label="" icon="category" className="w-full h-full" />
                              </div>
                              <div>
                                <div className="font-body-md text-on-surface font-semibold">
                                  {item.name}
                                </div>
                                <div className="text-[10px] font-label-caps text-secondary uppercase">
                                  {RARITY_LABEL[item.rarity]}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-price-display text-price-display text-on-surface-variant">
                            {formatPEN(item.marketPrice)}
                          </td>
                          <td className="px-6 py-4">
                            <input
                              className="bg-surface border border-white/10 text-on-surface font-label-caps text-center w-20 py-1 focus:ring-1 focus:ring-secondary focus:outline-none"
                              type="number"
                              step="0.1"
                              placeholder="global"
                              value={item.markupPercentOverride ?? ""}
                              onChange={(e) => handleMarkupChange(item.id, e.target.value)}
                            />
                          </td>
                          <td className="px-6 py-4 font-price-display text-price-display text-on-surface">
                            {formatPEN(item.price)}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleSyncPrice(item.id)}
                              disabled={syncingId === item.id}
                              className="flex items-center gap-1 text-secondary hover:underline font-label-caps text-[10px] disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">sync</span>
                              {syncingId === item.id ? "SINCRONIZANDO..." : "SYNC STEAM MARKET"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-6 py-4 flex justify-between items-center bg-surface-container-low border-t border-white/10">
                    <span className="text-on-surface-variant font-body-sm">
                      Mostrando {items.length} de {items.length} items
                    </span>
                  </div>
                </div>
              </section>
            )}

            {!dataLoading && tab === "warehouse" && (
              <section className="space-y-gutter">
                <div>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface">
                    Almacén de Steam
                  </h1>
                  <p className="font-body-md text-on-surface-variant">
                    Cuentas de Steam registradas como stock de la empresa — su inventario real
                    alimenta el catálogo público.
                  </p>
                </div>

                <div className="glass-panel p-6">
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-4">Cuentas</h2>
                  <div className="flex flex-col gap-2 mb-4">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between bg-surface border border-white/10 px-4 py-2"
                      >
                        <div>
                          <span className="font-body-md text-on-surface font-semibold">
                            {account.label}
                          </span>
                          <span className="text-on-surface-variant font-body-sm ml-2">
                            {account.steamId}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveAccount(account.id)}
                          disabled={removingAccountId === account.id}
                          className="text-error hover:underline font-label-caps text-[10px] disabled:opacity-50"
                        >
                          {removingAccountId === account.id ? "..." : "Quitar"}
                        </button>
                      </div>
                    ))}
                    {accounts.length === 0 && (
                      <p className="text-on-surface-variant font-body-sm">
                        Todavía no hay cuentas de almacén registradas.
                      </p>
                    )}
                  </div>

                  <form onSubmit={handleAddAccount} className="flex flex-wrap items-center gap-2 mb-4">
                    <input
                      className="bg-surface border border-white/10 text-on-surface font-body-sm py-2 px-3"
                      type="text"
                      placeholder="SteamID64 (17 dígitos)"
                      value={newAccountSteamId}
                      onChange={(e) => setNewAccountSteamId(e.target.value)}
                    />
                    <input
                      className="bg-surface border border-white/10 text-on-surface font-body-sm py-2 px-3"
                      type="text"
                      placeholder="Nombre (ej. Cuenta principal)"
                      value={newAccountLabel}
                      onChange={(e) => setNewAccountLabel(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={addingAccount}
                      className="bg-secondary text-on-secondary px-4 py-2 font-label-caps text-label-caps hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {addingAccount ? "Agregando..." : "Agregar cuenta"}
                    </button>
                  </form>

                  <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                    <button
                      onClick={handleSyncWarehouse}
                      disabled={syncingWarehouse}
                      className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 font-label-caps text-[10px] hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      <span
                        className={`material-symbols-outlined text-sm ${syncingWarehouse ? "animate-spin" : ""}`}
                      >
                        sync
                      </span>
                      {syncingWarehouse ? "Sincronizando..." : "Sincronizar almacén ahora"}
                    </button>
                    {warehouseMessage && (
                      <span className="font-body-sm text-primary">{warehouseMessage}</span>
                    )}
                  </div>
                </div>

                {unpublishedItems.length > 0 && (
                  <div className="glass-panel p-6 border-l-4 border-l-secondary">
                    <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
                      Pendientes de publicar ({unpublishedItems.length})
                    </h2>
                    <p className="font-body-sm text-on-surface-variant mb-4">
                      Items nuevos que trajo el último sync de almacén. Consulta el precio de Steam
                      como referencia, pon el precio que quieras, y publícalo para que recién ahí
                      salga en la tienda. Si vuelves a sincronizar y ya tienen copias iguales acá, no
                      se duplican — solo suma al stock una vez publicados.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-container-low border-b border-white/10">
                            <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                              Item
                            </th>
                            <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                              Precio Steam (ref.)
                            </th>
                            <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                              Precio final
                            </th>
                            <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                              Stock
                            </th>
                            <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {unpublishedItems.map((item) => (
                            <tr key={item.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-surface-container-highest border border-white/10 p-1 flex items-center justify-center">
                                    {item.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                                    ) : (
                                      <ImagePlaceholder label="" icon="category" className="w-full h-full" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-body-md text-on-surface font-semibold">
                                      {item.name}
                                    </div>
                                    <div className="text-[10px] font-label-caps text-secondary uppercase">
                                      {item.hero ?? CATEGORY_LABEL[item.category]} · {RARITY_LABEL[item.rarity]}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-price-display text-price-display text-on-surface-variant">
                                    {formatPEN(item.marketPrice)}
                                  </span>
                                  <button
                                    onClick={() => handleConsultPrice(item.id)}
                                    disabled={syncingId === item.id}
                                    className="flex items-center gap-1 text-secondary hover:underline font-label-caps text-[10px] disabled:opacity-50"
                                  >
                                    <span className="material-symbols-outlined text-sm">sync</span>
                                    {syncingId === item.id ? "..." : "Consultar"}
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <input
                                    className="bg-surface border border-white/10 text-on-surface font-label-caps text-center w-24 py-1 focus:ring-1 focus:ring-secondary focus:outline-none"
                                    type="number"
                                    step="0.1"
                                    placeholder={formatPEN(item.price)}
                                    value={priceInputs[item.id] ?? item.manualPriceOverride ?? ""}
                                    onChange={(e) =>
                                      setPriceInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                                    }
                                  />
                                  <button
                                    onClick={() => handlePriceSave(item.id)}
                                    disabled={savingPriceId === item.id}
                                    className="bg-secondary text-on-secondary px-3 py-2 font-label-caps text-[10px] hover:brightness-110 transition-all disabled:opacity-50"
                                  >
                                    {savingPriceId === item.id ? "..." : "Guardar"}
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-body-sm text-on-surface-variant">
                                {item.stock}
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => handlePublish(item.id)}
                                  disabled={publishingId === item.id}
                                  className="flex items-center gap-1 bg-primary text-on-primary px-3 py-2 font-label-caps text-[10px] hover:brightness-110 transition-all disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-sm">check_circle</span>
                                  {publishingId === item.id ? "..." : "Publicar"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {recentPendingItems.length > 0 && (
                  <div className="glass-panel p-6">
                    <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
                      Items recientes
                    </h2>
                    <p className="font-body-sm text-on-surface-variant mb-4">
                      Regalos recién recibidos, todavía en trade hold — se suman al stock disponible
                      cuando se liberan.
                    </p>
                    <div className="flex flex-col gap-2">
                      {recentPendingItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between bg-surface border border-white/10 px-4 py-2"
                        >
                          <span className="font-body-md text-on-surface">{item.name}</span>
                          <span className="text-on-surface-variant font-body-sm">
                            Disponible el{" "}
                            {new Date(item.pendingHolds[0]).toLocaleDateString("es-PE")}
                            {item.pendingHolds.length > 1 ? ` (+${item.pendingHolds.length - 1} más)` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="glass-panel p-6">
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-4">Catálogo</h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <select
                      value={filterHero}
                      onChange={(e) => setFilterHero(e.target.value)}
                      className="bg-surface border border-white/10 text-on-surface font-body-sm py-2 px-3"
                    >
                      <option value="">Todos los héroes</option>
                      {ALL_HERO_NAMES.map((hero) => (
                        <option key={hero} value={hero}>
                          {hero}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value as ItemCategory | "")}
                      className="bg-surface border border-white/10 text-on-surface font-body-sm py-2 px-3"
                    >
                      <option value="">Todas las categorías</option>
                      {ALL_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABEL[category]}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterRarity}
                      onChange={(e) => setFilterRarity(e.target.value as Rarity | "")}
                      className="bg-surface border border-white/10 text-on-surface font-body-sm py-2 px-3"
                    >
                      <option value="">Todas las rarezas</option>
                      {FILTERABLE_RARITIES.map((rarity) => (
                        <option key={rarity} value={rarity}>
                          {RARITY_LABEL[rarity]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-white/10">
                          <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                            Item
                          </th>
                          <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                            Precio Steam (ref.)
                          </th>
                          <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                            Precio final
                          </th>
                          <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                            Stock
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredWarehouseItems.map((item) => (
                          <tr key={item.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-surface-container-highest border border-white/10 p-1 flex items-center justify-center">
                                  {item.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                                  ) : (
                                    <ImagePlaceholder label="" icon="category" className="w-full h-full" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-body-md text-on-surface font-semibold">
                                    {item.name}
                                  </div>
                                  <div className="text-[10px] font-label-caps text-secondary uppercase">
                                    {item.hero ?? CATEGORY_LABEL[item.category]} · {RARITY_LABEL[item.rarity]}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-price-display text-price-display text-on-surface-variant">
                                  {formatPEN(item.marketPrice)}
                                </span>
                                <button
                                  onClick={() => handleConsultPrice(item.id)}
                                  disabled={syncingId === item.id}
                                  className="flex items-center gap-1 text-secondary hover:underline font-label-caps text-[10px] disabled:opacity-50"
                                  title="Pedirle a Steam Market el precio actual (solo como referencia, no cambia el precio final)"
                                >
                                  <span className="material-symbols-outlined text-sm">sync</span>
                                  {syncingId === item.id ? "..." : "Consultar"}
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <input
                                  className="bg-surface border border-white/10 text-on-surface font-label-caps text-center w-24 py-1 focus:ring-1 focus:ring-secondary focus:outline-none"
                                  type="number"
                                  step="0.1"
                                  placeholder={formatPEN(item.price)}
                                  value={priceInputs[item.id] ?? item.manualPriceOverride ?? ""}
                                  onChange={(e) =>
                                    setPriceInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                                  }
                                />
                                <button
                                  onClick={() => handlePriceSave(item.id)}
                                  disabled={savingPriceId === item.id}
                                  className="bg-secondary text-on-secondary px-3 py-2 font-label-caps text-[10px] hover:brightness-110 transition-all disabled:opacity-50"
                                >
                                  {savingPriceId === item.id ? "..." : "Guardar"}
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2 py-1 font-label-caps text-[10px] uppercase ${
                                  item.stock > 0
                                    ? "bg-primary/10 text-primary"
                                    : "bg-error/10 text-error"
                                }`}
                              >
                                {item.stock > 0 ? `${item.stock} disponibles` : "Agotado"}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filteredWarehouseItems.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-on-surface-variant">
                              No hay items que coincidan con estos filtros.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {!dataLoading && tab === "orders" && (
              <section className="space-y-gutter">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h1 className="font-headline-lg text-headline-lg text-on-surface">
                      Órdenes de Venta
                    </h1>
                    <p className="font-body-md text-on-surface-variant">
                      Revisa y procesa las solicitudes de venta de los usuarios.
                    </p>
                  </div>
                  <div className="flex gap-base">
                    <div className="bg-surface-container-low border border-white/10 px-4 py-2 flex items-center gap-4">
                      <span className="font-label-caps text-label-caps text-primary">
                        {pendingCount} Solicitudes Pendientes
                      </span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto glass-panel">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-white/10">
                        <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                          Usuario
                        </th>
                        <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                          Items
                        </th>
                        <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                          Valor Total
                        </th>
                        <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                          Trade Link
                        </th>
                        <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                          Estado
                        </th>
                        <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-body-md text-on-surface font-semibold">
                              {order.userDisplayName}
                            </div>
                            <div className="text-[10px] font-label-caps text-on-surface-variant">
                              {new Date(order.createdAt).toLocaleString("es-PE")}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-body-sm text-on-surface-variant">
                              {order.lineItems.length} item(s)
                            </div>
                          </td>
                          <td className="px-6 py-4 font-price-display text-price-display text-on-surface">
                            {formatPEN(order.total)}
                          </td>
                          <td className="px-6 py-4">
                            <a
                              href={order.tradeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-secondary hover:underline font-label-caps text-[10px]"
                            >
                              <span className="material-symbols-outlined text-sm">link</span>
                              VER TRADE LINK
                            </a>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 font-label-caps text-[10px] uppercase ${statusClass[order.status]}`}
                            >
                              {statusLabel[order.status]}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleOrderAction(order.id, "approve")}
                                disabled={order.status !== "pendiente"}
                                className="bg-primary-container text-on-primary-container p-2 hover:brightness-110 active:scale-95 duration-150 transition-all disabled:opacity-30"
                                aria-label="Aprobar orden"
                              >
                                <span className="material-symbols-outlined text-sm">check</span>
                              </button>
                              <button
                                onClick={() => handleOrderAction(order.id, "reject")}
                                disabled={order.status !== "pendiente"}
                                className="bg-surface-container-high text-on-surface-variant p-2 hover:text-primary transition-all disabled:opacity-30"
                                aria-label="Rechazar orden"
                              >
                                <span className="material-symbols-outlined text-sm">close</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {orders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">
                            Todavía no hay órdenes de venta.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {!dataLoading && tab === "analytics" && (
              <section className="space-y-gutter">
                <h1 className="font-headline-lg text-headline-lg text-on-surface">
                  Analítica de Mercado
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                  <div className="glass-panel h-64 flex flex-col items-center justify-center text-on-surface-variant border-dashed border-2">
                    <span className="material-symbols-outlined text-4xl mb-4">show_chart</span>
                    <p className="font-label-caps uppercase">Módulo de Tendencia de Ventas</p>
                  </div>
                  <div className="glass-panel h-64 flex flex-col items-center justify-center text-on-surface-variant border-dashed border-2">
                    <span className="material-symbols-outlined text-4xl mb-4">pie_chart</span>
                    <p className="font-label-caps uppercase">Distribución del Inventario</p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
