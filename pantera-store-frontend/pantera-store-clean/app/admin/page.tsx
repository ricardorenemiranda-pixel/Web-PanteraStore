"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminItemCard from "@/components/AdminItemCard";
import ConfirmDialog from "@/components/ConfirmDialog";
import PdfExportModal from "@/components/PdfExportModal";
import { useAuth } from "@/lib/AuthContext";
import {
  AdminItem,
  AdminOrder,
  approveOrder,
  deleteItem,
  fetchAllItemsAdmin,
  fetchOrders,
  fetchPricingConfig,
  fetchSyncStatus,
  PricingConfig,
  rejectOrder,
  SellableRarity,
  syncPricesNow,
  updateRarityMarkup,
} from "@/lib/adminApi";
import { ALL_HERO_NAMES, CATEGORY_LABEL, ItemCategory, RARITY_LABEL, Rarity } from "@/lib/mock-data";
import { formatPEN } from "@/lib/currency";

type Tab = "catalog" | "orders" | "analytics";

const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL) as ItemCategory[];
const ALL_RARITIES = Object.keys(RARITY_LABEL) as Rarity[];

const statusLabel: Record<AdminOrder["status"], string> = {
  pendiente: "Pendiente",
  procesado: "Procesado",
  rechazado: "Rechazado",
};
const statusClass: Record<AdminOrder["status"], string> = {
  pendiente: "bg-secondary/10 text-secondary border border-secondary/20",
  procesado: "bg-surface-container-highest text-on-surface-variant border border-on-surface/10",
  rechazado: "bg-error/10 text-error border border-error/20",
};

const SELLABLE_RARITIES: SellableRarity[] = ["mythical", "legendary", "immortal", "arcana"];

const RARITY_DOT_CLASS: Record<SellableRarity, string> = {
  mythical: "bg-rarity-mythical",
  legendary: "bg-rarity-legendary",
  immortal: "bg-rarity-immortal",
  arcana: "bg-rarity-arcana",
};

/** Precio de referencia para el ejemplo en vivo junto a cada % de markup. */
const MARKUP_PREVIEW_PRICE = 10;

function emptyRarityInputs(): Record<SellableRarity, string> {
  return { mythical: "", legendary: "", immortal: "", arcana: "" };
}

export default function AdminPage() {
  const { user, loading: userLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("catalog");

  const [items, setItems] = useState<AdminItem[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [rarityInputs, setRarityInputs] = useState<Record<SellableRarity, string>>(emptyRarityInputs());
  const [savingRarity, setSavingRarity] = useState<SellableRarity | null>(null);
  const [syncingNow, setSyncingNow] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncWaiting, setSyncWaiting] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterHero, setFilterHero] = useState("");
  const [filterCategory, setFilterCategory] = useState<ItemCategory | "">("");
  const [filterRarity, setFilterRarity] = useState<Rarity | "">("");
  const [searchCode, setSearchCode] = useState("");
  const [filterCustomMarkup, setFilterCustomMarkup] = useState(false);

  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    danger?: boolean;
    action: () => Promise<void> | void;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const isAdmin = user?.role === "admin";

  function askConfirm(message: string, action: () => Promise<void> | void, danger = false) {
    setConfirmDialog({ message, action, danger });
  }

  async function handleConfirmAccept() {
    if (!confirmDialog) return;
    setConfirmLoading(true);
    try {
      await confirmDialog.action();
    } finally {
      setConfirmLoading(false);
      setConfirmDialog(null);
    }
  }

  function handleConfirmCancel() {
    setConfirmDialog(null);
  }

  useEffect(() => {
    if (!isAdmin) return;
    setDataLoading(true);
    Promise.all([fetchAllItemsAdmin(), fetchOrders(), fetchPricingConfig()])
      .then(([itemsData, ordersData, configData]) => {
        setItems(itemsData);
        setOrders(ordersData);
        setConfig(configData);
        setRarityInputs({
          mythical: configData.rarityMarkups.mythical?.toString() ?? "",
          legendary: configData.rarityMarkups.legendary?.toString() ?? "",
          immortal: configData.rarityMarkups.immortal?.toString() ?? "",
          arcana: configData.rarityMarkups.arcana?.toString() ?? "",
        });
      })
      .catch(() => setError("No pudimos cargar los datos del panel."))
      .finally(() => setDataLoading(false));
  }, [isAdmin]);

  function handleDeleteItem(itemId: string, name: string) {
    askConfirm(
      `¿Eliminar "${name}" del catálogo? Esta acción no se puede deshacer.`,
      async () => {
        setDeletingId(itemId);
        try {
          await deleteItem(itemId);
          setItems((prev) => prev.filter((i) => i.id !== itemId));
        } catch {
          setError("No se pudo eliminar el item.");
        } finally {
          setDeletingId(null);
        }
      },
      true,
    );
  }

  const filteredCatalogItems = useMemo(() => {
    return items.filter((item) => {
      if (searchCode && !item.referenceCode.includes(searchCode.trim())) return false;
      if (filterHero && item.hero !== filterHero) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterRarity && item.rarity !== filterRarity) return false;
      if (filterCustomMarkup && item.markupPercentOverride === null) return false;
      return true;
    });
  }, [items, searchCode, filterHero, filterCategory, filterRarity, filterCustomMarkup]);

  const customMarkupCount = useMemo(
    () => items.filter((item) => item.markupPercentOverride !== null).length,
    [items],
  );

  function clearFilters() {
    setSearchCode("");
    setFilterHero("");
    setFilterCategory("");
    setFilterRarity("");
    setFilterCustomMarkup(false);
  }

  function goToCustomMarkupItems() {
    setSearchCode("");
    setFilterHero("");
    setFilterCategory("");
    setFilterRarity("");
    setFilterCustomMarkup(true);
  }

  function handleRarityMarkupSave(rarity: SellableRarity) {
    const raw = rarityInputs[rarity];
    const percent = raw.trim() === "" ? null : Number(raw);
    if (percent !== null && Number.isNaN(percent)) return;

    const itemsOfRarity = items.filter((i) => i.rarity === rarity);
    const affected = itemsOfRarity.filter((i) => i.markupPercentOverride === null);
    const customInRarity = itemsOfRarity.length - affected.length;
    const rarityLabel = RARITY_LABEL[rarity];

    const message =
      percent === null
        ? `¿Quitar el markup fijo de ${rarityLabel}? Los ${affected.length} item${affected.length === 1 ? "" : "s"} de esa rareza volverán a usar el markup global.`
        : `¿Aplicar ${percent}% de markup a los ${affected.length} item${affected.length === 1 ? "" : "s"} de rareza ${rarityLabel}?` +
          (customInRarity > 0
            ? `\n\nLos ${customInRarity} item${customInRarity === 1 ? "" : "s"} de ${rarityLabel} con markup personalizado no se verán afectados.`
            : "");

    askConfirm(message, async () => {
      setSavingRarity(rarity);
      try {
        await updateRarityMarkup(rarity, percent);
        setConfig((prev) => (prev ? { ...prev, rarityMarkups: { ...prev.rarityMarkups, [rarity]: percent } } : prev));
        const refreshed = await fetchAllItemsAdmin();
        setItems(refreshed);
      } catch {
        setError(`No se pudo actualizar el markup de ${rarityLabel}.`);
      } finally {
        setSavingRarity(null);
      }
    });
  }

  // Sigue el avance real de la sincronización hasta que termine, sin límite
  // de tiempo: si Steam bloquea, el backend espera y reanuda solo, y acá la
  // barra simplemente queda quieta ("Esperando a Steam") sin mostrar error.
  async function watchSync() {
    setSyncingNow(true);
    setSyncMessage("");
    try {
      let syncing = true;
      while (syncing) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          const status = await fetchSyncStatus();
          syncing = status.syncing;
          setSyncWaiting(status.waiting);
          setSyncProgress(status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0);
        } catch {
          // Un fallo puntual de red no interrumpe el seguimiento; se reintenta.
        }
      }
      const refreshed = await fetchAllItemsAdmin();
      setItems(refreshed);
      setSyncMessage("Precios sincronizados correctamente.");
    } finally {
      setSyncingNow(false);
      setSyncWaiting(false);
      setSyncProgress(0);
    }
  }

  async function handleSyncNow() {
    setSyncProgress(0);
    try {
      await syncPricesNow();
    } catch {
      setError("No se pudo iniciar la sincronización de precios.");
      return;
    }
    await watchSync();
  }

  // Si se recarga la página con una sincronización en curso, se retoma el seguimiento.
  useEffect(() => {
    if (!isAdmin) return;
    fetchSyncStatus()
      .then((status) => {
        if (status.syncing) void watchSync();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function handleOrderAction(orderId: string, action: "approve" | "reject") {
    try {
      const updated = action === "approve" ? await approveOrder(orderId) : await rejectOrder(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch {
      setError("No se pudo actualizar la orden.");
    }
  }

  const pendingCount = orders.filter((o) => o.status === "pendiente").length;

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
      {/* Header + navegación de admin, fijos arriba */}
      <div className="fixed top-0 left-0 w-full z-50 bg-surface/80 backdrop-blur-xl border-b border-on-surface/10">
        <header className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16">
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

        <nav className="h-12 flex items-center gap-1 px-margin-mobile md:px-margin-desktop border-t border-on-surface/5 overflow-x-auto">
          {[
            { id: "catalog" as Tab, label: "Catálogo", icon: "inventory_2" },
            { id: "orders" as Tab, label: "Órdenes", icon: "shopping_cart" },
            { id: "analytics" as Tab, label: "Analítica", icon: "analytics" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "h-full flex items-center gap-2 px-4 text-secondary border-b-2 border-secondary transition-all duration-150 shrink-0"
                  : "h-full flex items-center gap-2 px-4 text-on-surface-variant border-b-2 border-transparent hover:text-on-surface hover:bg-on-surface/5 transition-colors shrink-0"
              }
            >
              <span className="material-symbols-outlined text-lg">{t.icon}</span>
              <span className="font-label-caps text-label-caps uppercase">{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="flex min-h-screen">
        {/* Contenido */}
        <main className="flex-1 pt-28 pb-24 min-h-screen bg-surface">
          <div className="max-w-[1600px] mx-auto px-margin-mobile md:px-margin-desktop py-12">
            {error && (
              <div className="mb-6 bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">
                {error}
              </div>
            )}

            {dataLoading && <p className="text-on-surface-variant">Cargando...</p>}

            {!dataLoading && tab === "catalog" && (
              <section className="space-y-gutter">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h1 className="font-headline-lg text-headline-lg text-on-surface">
                      Catálogo y Precios
                    </h1>
                    <p className="font-body-md text-on-surface-variant">
                      Administra tus items, sus precios y el margen de la tienda en un solo lugar.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPdfModalOpen(true)}
                      className="flex items-center gap-2 bg-secondary text-on-secondary px-4 py-2 font-label-caps text-label-caps hover:brightness-110 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                      Exportar PDF
                    </button>
                    <Link
                      href="/admin/items/new"
                      className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 font-label-caps text-label-caps hover:brightness-110 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Nuevo item
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-gutter items-start">
                  {/* Catálogo: filtros + grilla de items (columna principal) */}
                  <div className="xl:col-span-3 flex flex-col gap-gutter">
                    <div className="bg-surface-container border border-on-surface/5 p-4 flex flex-col md:flex-row md:items-end gap-4">
                      <div className="flex-1 w-full">
                        <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                          Código
                        </label>
                        <input
                          type="text"
                          value={searchCode}
                          onChange={(e) => setSearchCode(e.target.value)}
                          className="w-full bg-surface border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                          Héroe
                        </label>
                        <select
                          value={filterHero}
                          onChange={(e) => setFilterHero(e.target.value)}
                          className="w-full bg-surface border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
                        >
                          <option value="">Todos</option>
                          {ALL_HERO_NAMES.map((hero) => (
                            <option key={hero} value={hero}>
                              {hero}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 w-full">
                        <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                          Categoría
                        </label>
                        <select
                          value={filterCategory}
                          onChange={(e) => setFilterCategory(e.target.value as ItemCategory | "")}
                          className="w-full bg-surface border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
                        >
                          <option value="">Todas</option>
                          {ALL_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {CATEGORY_LABEL[category]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 w-full">
                        <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                          Rareza
                        </label>
                        <select
                          value={filterRarity}
                          onChange={(e) => setFilterRarity(e.target.value as Rarity | "")}
                          className="w-full bg-surface border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
                        >
                          <option value="">Todas</option>
                          {ALL_RARITIES.map((rarity) => (
                            <option key={rarity} value={rarity}>
                              {RARITY_LABEL[rarity]}
                            </option>
                          ))}
                        </select>
                      </div>
                      {(searchCode || filterHero || filterCategory || filterRarity || filterCustomMarkup) && (
                        <button
                          onClick={clearFilters}
                          className="w-full md:w-auto px-4 py-2 font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">clear</span>
                          Limpiar
                        </button>
                      )}
                    </div>

                    <p className="font-body-sm text-on-surface-variant flex items-center gap-2 flex-wrap">
                      {filteredCatalogItems.length} item{filteredCatalogItems.length === 1 ? "" : "s"} en el catálogo
                      {filterCustomMarkup && (
                        <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 font-label-caps text-[9px] uppercase">
                          Markup personalizado
                          <button
                            type="button"
                            onClick={() => setFilterCustomMarkup(false)}
                            aria-label="Quitar filtro de markup personalizado"
                            className="hover:text-primary"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        </span>
                      )}
                    </p>

                    {filteredCatalogItems.length === 0 ? (
                      <p className="text-center py-16 font-body-md text-on-surface-variant bg-surface-container border border-on-surface/5">
                        No hay items que coincidan con estos filtros.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-gutter">
                        {filteredCatalogItems.map((item) => (
                          <AdminItemCard
                            key={item.id}
                            item={item}
                            deleting={deletingId === item.id}
                            onEdit={() => router.push(`/admin/items/${item.id}`)}
                            onDelete={() => handleDeleteItem(item.id, item.name)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Precios: markup global, por rareza, y sync (columna lateral) */}
                  <div className="flex flex-col gap-gutter">
                    {config && (
                      <div className="bg-surface-container border border-on-surface/5">
                        <div className="flex items-start justify-between gap-3 p-5 pb-4 border-b border-on-surface/5">
                          <div>
                            <h2 className="font-body-md text-on-surface font-semibold">Markup por rareza</h2>
                            <p className="font-body-sm text-on-surface-variant mt-0.5">
                              Vacío = usa el markup global de esa rareza.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={goToCustomMarkupItems}
                            disabled={customMarkupCount === 0}
                            className="shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 border border-on-surface/10 hover:border-secondary/40 hover:bg-secondary/5 transition-colors disabled:opacity-30 disabled:hover:border-on-surface/10 disabled:hover:bg-transparent"
                          >
                            <span className="font-headline-sm text-headline-sm text-secondary leading-none">
                              {customMarkupCount}
                            </span>
                            <span className="font-label-caps text-[9px] text-on-surface-variant uppercase whitespace-nowrap">
                              Personalizados
                            </span>
                          </button>
                        </div>

                        <div className="divide-y divide-on-surface/5">
                          {SELLABLE_RARITIES.map((rarity) => {
                            const raw = rarityInputs[rarity];
                            const usingGlobal = raw.trim() === "";
                            const percent = usingGlobal ? config.globalMarkupPercent : Number(raw);
                            const previewFinal = Number.isNaN(percent)
                              ? null
                              : MARKUP_PREVIEW_PRICE * (1 + percent / 100);

                            return (
                              <div key={rarity} className="flex flex-col gap-2 px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <span className={`w-2 h-2 shrink-0 rounded-full ${RARITY_DOT_CLASS[rarity]}`} />
                                  <label className="font-body-sm text-on-surface w-24 shrink-0">
                                    {RARITY_LABEL[rarity]}
                                  </label>
                                  <input
                                    className="flex-1 min-w-0 bg-surface border border-on-surface/10 text-on-surface font-body-sm py-1.5 px-3 focus:ring-1 focus:ring-secondary focus:outline-none"
                                    type="number"
                                    step="0.1"
                                    value={rarityInputs[rarity]}
                                    onChange={(e) =>
                                      setRarityInputs((prev) => ({ ...prev, [rarity]: e.target.value }))
                                    }
                                    onFocus={(e) => e.target.select()}
                                  />
                                  <span className="font-body-sm text-on-surface-variant shrink-0">%</span>
                                  <button
                                    onClick={() => handleRarityMarkupSave(rarity)}
                                    disabled={savingRarity === rarity}
                                    aria-label={`Aplicar markup de ${RARITY_LABEL[rarity]}`}
                                    className="shrink-0 w-8 h-8 flex items-center justify-center border border-on-surface/10 text-on-surface-variant hover:border-secondary hover:text-secondary transition-colors disabled:opacity-50"
                                  >
                                    <span className="material-symbols-outlined text-base">
                                      {savingRarity === rarity ? "hourglass_empty" : "check"}
                                    </span>
                                  </button>
                                </div>

                                {previewFinal !== null && (
                                  <div className="flex items-center gap-2 pl-5 font-body-sm">
                                    <span className="text-on-surface-variant">{formatPEN(MARKUP_PREVIEW_PRICE)}</span>
                                    <span className="material-symbols-outlined text-sm text-on-surface-variant">
                                      arrow_forward
                                    </span>
                                    <span className="text-secondary font-semibold">{formatPEN(previewFinal)}</span>
                                    {usingGlobal && (
                                      <span className="font-label-caps text-[9px] text-on-surface-variant uppercase">
                                        (global {config.globalMarkupPercent}%)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-col gap-3 p-5 pt-4 border-t border-on-surface/5">
                          <button
                            onClick={handleSyncNow}
                            disabled={syncingNow}
                            className="relative overflow-hidden flex items-center justify-center gap-2 bg-primary text-on-primary px-4 py-3 font-label-caps text-label-caps hover:brightness-110 transition-all disabled:opacity-90"
                          >
                            <span className={`material-symbols-outlined text-base ${syncingNow ? "animate-spin" : ""}`}>
                              sync
                            </span>
                            {syncingNow
                              ? syncWaiting
                                ? `Esperando a Steam... ${syncProgress}%`
                                : `Sincronizando... ${syncProgress}%`
                              : "Sincronizar todos los ítems"}
                            {syncingNow && (
                              <span
                                className="absolute bottom-0 left-0 h-[3px] bg-on-primary/60 transition-all duration-300 ease-out"
                                style={{ width: `${syncProgress}%` }}
                              />
                            )}
                          </button>
                          <p className="font-body-sm text-on-surface-variant">
                            Consulta el precio actual en Steam Market para todos los items del catálogo.
                          </p>

                          {syncMessage && <p className="font-body-sm text-primary">{syncMessage}</p>}
                        </div>
                      </div>
                    )}
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
                    <div className="bg-surface-container-low border border-on-surface/10 px-4 py-2 flex items-center gap-4">
                      <span className="font-label-caps text-label-caps text-primary">
                        {pendingCount} Solicitudes Pendientes
                      </span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto bg-surface-container border border-on-surface/5">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-on-surface/5">
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
                    <tbody className="divide-y divide-on-surface/5">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-on-surface/5 transition-colors">
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
                  <div className="h-64 flex flex-col items-center justify-center text-on-surface-variant border border-dashed border-on-surface/10">
                    <span className="material-symbols-outlined text-4xl mb-4">show_chart</span>
                    <p className="font-label-caps uppercase">Módulo de Tendencia de Ventas</p>
                  </div>
                  <div className="h-64 flex flex-col items-center justify-center text-on-surface-variant border border-dashed border-on-surface/10">
                    <span className="material-symbols-outlined text-4xl mb-4">pie_chart</span>
                    <p className="font-label-caps uppercase">Distribución del Inventario</p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      <PdfExportModal open={pdfModalOpen} onClose={() => setPdfModalOpen(false)} />
      <ConfirmDialog
        open={!!confirmDialog}
        message={confirmDialog?.message ?? ""}
        danger={confirmDialog?.danger}
        loading={confirmLoading}
        onConfirm={handleConfirmAccept}
        onCancel={handleConfirmCancel}
      />
    </div>
  );
}
