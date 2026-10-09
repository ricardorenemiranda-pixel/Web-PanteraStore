"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/AuthContext";
import { useSellableInventory } from "@/lib/useSellableInventory";
import { RARITY_CLASS, RARITY_TEXT_CLASS, RARITY_LABEL } from "@/lib/mock-data";
import { formatPEN } from "@/lib/currency";

const WHATSAPP_NUMBER = "51900000000"; // TODO: reemplazar por el número real de la empresa

function ResumenContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams?.get("items") ?? "";
  const selectedIds = idsParam.split(",").filter(Boolean);

  const { user } = useAuth();
  const { items: inventory, status } = useSellableInventory();

  const items = useMemo(
    () => inventory.filter((item) => selectedIds.includes(item.assetId)),
    [inventory, selectedIds.join(",")]
  );

  const [tradeUrl, setTradeUrl] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState("");

  // Pre-llena con lo guardado en el perfil, así no hay que volver a
  // escribirlo cada vez que se vende (se puede editar igual antes de confirmar).
  useEffect(() => {
    if (user?.tradeUrl) setTradeUrl(user.tradeUrl);
    if (user?.displayName) setUserName(user.displayName);
  }, [user?.tradeUrl, user?.displayName]);

  const total = items.reduce((sum, item) => sum + (item.buybackPrice ?? 0), 0);

  function handleConfirm() {
    if (!userName.trim()) {
      setError("Ingresa tu nombre de usuario de Steam.");
      return;
    }
    if (!tradeUrl.trim()) {
      setError("Ingresa tu Steam Trade URL para continuar.");
      return;
    }
    setError("");

    const itemLines = items.map(
      (item) => `- ${item.name} (${formatPEN(item.buybackPrice ?? 0)})`
    );
    const message = encodeURIComponent(
      `Hola PanteraStore, quiero confirmar mi venta:\n\n` +
        `Usuario: ${userName}\n\n` +
        `Items:\n${itemLines.join("\n")}\n\n` +
        `Total a recibir: ${formatPEN(total)}\n` +
        `Trade URL: ${tradeUrl}\n\n` +
        `Quedo pendiente de la oferta de intercambio.`
    );

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
  }

  return (
    <>
      <Header />
      <main className="flex-grow pt-24 pb-32 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Lista de items */}
          <div className="lg:col-span-8">
            <div className="flex items-center gap-4 mb-8">
              <Link
                href="/inventario"
                className="p-2 glass-panel rounded-full hover:bg-on-surface/10 transition-colors"
              >
                <span className="material-symbols-outlined align-middle">arrow_back</span>
              </Link>
              <div>
                <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg">
                  Resumen de Venta
                </h1>
                <p className="text-on-surface-variant font-body-sm">
                  Revisa tus artículos antes de confirmar la transacción.
                </p>
              </div>
            </div>

            {status === "loading" && (
              <div className="glass-panel p-8 text-center text-on-surface-variant">
                Cargando tus items...
              </div>
            )}

            {status !== "loading" && items.length === 0 ? (
              <div className="glass-panel p-8 text-center text-on-surface-variant">
                No seleccionaste ningún item.{" "}
                <Link href="/inventario" className="text-primary underline">
                  Vuelve a tu inventario
                </Link>{" "}
                para elegir qué vender.
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.assetId}
                    className={`glass-panel p-4 flex items-center gap-4 ${RARITY_CLASS[item.rarity]} group`}
                  >
                    <div className="w-20 h-20 bg-surface-container flex-shrink-0 relative overflow-hidden p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-grow">
                      <span
                        className={`font-label-caps text-label-caps px-2 py-0.5 mb-1 inline-block bg-on-surface/5 ${RARITY_TEXT_CLASS[item.rarity]}`}
                      >
                        {RARITY_LABEL[item.rarity].toUpperCase()}
                      </span>
                      <h3 className="font-headline-md text-[18px]">{item.name}</h3>
                      <p className="text-on-surface-variant text-sm font-body-sm">
                        {item.hero ?? "Universal"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">
                        PRECIO DE RECOMPRA
                      </p>
                      <p className="font-price-display text-price-display text-secondary">
                        {formatPEN(item.buybackPrice ?? 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirmación */}
          <div className="lg:col-span-4">
            <div className="glass-panel p-gutter sticky top-24">
              <h2 className="font-headline-md text-headline-md mb-6 border-b border-on-surface/10 pb-4">
                Total a Recibir
              </h2>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between font-body-md">
                  <span className="text-on-surface-variant">Subtotal ({items.length} items)</span>
                  <span>{formatPEN(total)}</span>
                </div>
                <div className="flex justify-between font-body-md">
                  <span className="text-on-surface-variant">Comisión de plataforma (0%)</span>
                  <span className="text-rarity-arcana">{formatPEN(0)}</span>
                </div>
                <div className="pt-4 border-t border-on-surface/10 flex justify-between items-end">
                  <span className="font-headline-md text-headline-md">Total Final</span>
                  <span className="font-price-display text-[32px] text-primary">
                    {formatPEN(total)}
                  </span>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block font-label-caps text-label-caps text-secondary mb-2" htmlFor="user-name">
                    NOMBRE DE USUARIO (STEAM)
                  </label>
                  <input
                    id="user-name"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Tu nombre de usuario"
                    className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg p-4 font-body-sm focus:outline-none focus:border-secondary transition-colors"
                  />
                </div>
                <div>
                  <label className="block font-label-caps text-label-caps text-secondary mb-2" htmlFor="trade-url">
                    STEAM TRADE URL
                  </label>
                  <input
                    id="trade-url"
                    type="text"
                    value={tradeUrl}
                    onChange={(e) => setTradeUrl(e.target.value)}
                    placeholder="https://steamcommunity.com/tradeoffer/new/..."
                    className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg p-4 font-body-sm focus:outline-none focus:border-secondary transition-colors"
                  />
                  <p className="text-[10px] text-on-surface-variant mt-2 px-1">
                    Necesitamos esto para enviarte la oferta de intercambio de forma segura.
                  </p>
                </div>
                {error && <p className="text-error text-body-sm">{error}</p>}
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={items.length === 0}
                  className="w-full bg-primary text-on-primary font-headline-md py-5 flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">send</span>
                  Confirmar y enviar por WhatsApp
                </button>
                <div className="flex items-center gap-3 p-4 bg-secondary/5 border border-secondary/10 rounded-lg">
                  <span className="material-symbols-outlined text-secondary">verified_user</span>
                  <p className="text-[11px] font-body-sm text-on-surface-variant uppercase tracking-wider">
                    La venta se confirma manualmente por nuestro equipo vía WhatsApp
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}

export default function ResumenVentaPage() {
  return (
    <Suspense fallback={null}>
      <ResumenContent />
    </Suspense>
  );
}
