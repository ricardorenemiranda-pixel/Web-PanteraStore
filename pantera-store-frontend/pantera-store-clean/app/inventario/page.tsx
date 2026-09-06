"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useSellableInventory } from "@/lib/useSellableInventory";
import { RARITY_CLASS, RARITY_LABEL, RARITY_TEXT_CLASS } from "@/lib/mock-data";
import { formatPEN } from "@/lib/currency";

export default function InventarioPage() {
  const router = useRouter();
  const { items, status, refreshing, refresh } = useSellableInventory();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggle(assetId: string, buybackPrice: number | null) {
    if (buybackPrice === null) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }

  const { count, total } = useMemo(() => {
    let sum = 0;
    items.forEach((item) => {
      if (selectedIds.has(item.assetId) && item.buybackPrice !== null) sum += item.buybackPrice;
    });
    return { count: selectedIds.size, total: sum };
  }, [selectedIds, items]);

  function handleVender() {
    const ids = Array.from(selectedIds).join(",");
    router.push(`/vender/resumen?items=${encodeURIComponent(ids)}`);
  }

  return (
    <>
      <Header />
      <main className="pt-24 pb-32 px-margin-mobile md:px-margin-desktop min-h-screen max-w-container-max mx-auto relative overflow-hidden">
        <section className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-base">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">
                Mi Inventario
              </h1>
              <p className="text-on-surface-variant font-body-md">
                Selecciona los items que quieres vender y conviértelos al instante en soles.
                Solo se muestran items Mítico, Legendario, Inmortal y Arcano.
              </p>
            </div>
            {status === "ready" && (
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="glass-panel px-4 py-2 flex items-center gap-2 rounded-lg border border-white/10 hover:border-primary/40 transition-colors disabled:opacity-50 self-start"
              >
                <span
                  className={`material-symbols-outlined text-primary text-sm ${refreshing ? "animate-spin" : ""}`}
                >
                  refresh
                </span>
                <span className="font-label-caps text-on-surface">
                  {refreshing ? "Actualizando..." : "Actualizar inventario"}
                </span>
              </button>
            )}
          </div>
        </section>

        {status === "unauthenticated" && (
          <div className="glass-panel p-8 text-center text-on-surface-variant">
            Inicia sesión con Steam para ver tu inventario.{" "}
            <Link href="/login" className="text-primary underline">
              Iniciar sesión
            </Link>
          </div>
        )}

        {status === "loading" && (
          <p className="text-on-surface-variant text-body-sm mt-12 text-center">
            Cargando tu inventario de Steam...
          </p>
        )}

        {status === "error" && (
          <p className="text-error text-body-sm mt-12 text-center">
            No pudimos leer tu inventario de Steam. Verifica que tu inventario sea público e
            intenta de nuevo.
          </p>
        )}

        {status === "rate-limited" && (
          <div className="text-center mt-12">
            <p className="text-error text-body-sm mb-4">
              Steam está limitando las peticiones ahora mismo. Espera unos segundos e intenta de nuevo.
            </p>
            <button
              type="button"
              onClick={refresh}
              className="glass-panel px-4 py-2 rounded-lg border border-white/10 hover:border-primary/40 transition-colors font-label-caps text-on-surface"
            >
              Reintentar
            </button>
          </div>
        )}

        {status === "ready" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-gutter">
            {items.map((item) => {
              const selected = selectedIds.has(item.assetId);
              const unavailable = item.buybackPrice === null;
              return (
                <div
                  key={item.assetId}
                  onClick={() => toggle(item.assetId, item.buybackPrice)}
                  className={`item-card glass-panel group relative flex flex-col p-0 overflow-hidden transition-all ${RARITY_CLASS[item.rarity]} ${
                    unavailable ? "opacity-50 cursor-not-allowed" : "hover:brightness-110 cursor-pointer"
                  } ${selected ? "ring-2 ring-primary bg-primary/5" : ""}`}
                >
                  <div className="absolute top-3 left-3 z-20">
                    <input
                      className="custom-checkbox w-5 h-5 rounded border-white/20 bg-black/40 text-primary focus:ring-primary pointer-events-none"
                      type="checkbox"
                      checked={selected}
                      readOnly
                    />
                  </div>
                  <div className="relative w-full aspect-square bg-[#0a0a0a] flex items-center justify-center p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                  </div>
                  <div className="p-4 flex flex-col gap-1">
                    <span className={`font-label-caps text-[10px] font-bold ${RARITY_TEXT_CLASS[item.rarity]}`}>
                      {RARITY_LABEL[item.rarity].toUpperCase()}
                    </span>
                    <h3 className="font-body-md font-bold text-on-surface truncate">{item.name}</h3>
                    <div className="mt-4 flex flex-col">
                      <span className="font-label-caps text-[10px] text-on-surface-variant">
                        RECOMPRA ESTIMADA
                      </span>
                      <span className="font-price-display text-price-display text-primary">
                        {unavailable ? "No disponible" : formatPEN(item.buybackPrice as number)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <p className="text-on-surface-variant text-body-sm mt-12 text-center">
            No encontramos items Mítico, Legendario, Inmortal o Arcano en tu inventario de Dota 2.
          </p>
        )}
      </main>

      {/* Barra de selección flotante */}
      <footer
        className={`fixed bottom-0 left-0 w-full z-50 transform transition-transform duration-300 ${
          count > 0 ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto max-w-5xl px-4 pb-6">
          <div className="bg-surface-container-highest/95 backdrop-blur-xl border border-white/10 rounded-full h-20 px-8 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="font-headline-md text-primary leading-none">{count}</span>
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">
                  Items Seleccionados
                </span>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="flex flex-col">
                <span className="font-headline-md text-on-surface leading-none">
                  {formatPEN(total)}
                </span>
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">
                  Total Estimado a Recibir
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleVender}
              disabled={count === 0}
              className="bg-primary hover:brightness-110 active:scale-95 transition-all text-on-primary font-headline-md px-10 py-3 rounded-full flex items-center gap-2 group disabled:opacity-50"
            >
              <span>Vender seleccionados</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
