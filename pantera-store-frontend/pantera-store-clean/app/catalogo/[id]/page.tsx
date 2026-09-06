import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import { RARITY_LABEL, RARITY_BADGE_CLASS, CATEGORY_LABEL } from "@/lib/mock-data";
import { formatPEN } from "@/lib/currency";
import { fetchCatalogItem, fetchCatalogItems, type CatalogItem } from "@/lib/catalogApi";

const WHATSAPP_NUMBER = "51900000000"; // TODO: reemplazar por el número real de la empresa

function itemSubtitle(item: CatalogItem): string {
  return item.hero ?? CATEGORY_LABEL[item.category];
}

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const item = await fetchCatalogItem(params.id);
  if (!item) return notFound();

  const allItems = await fetchCatalogItems().catch(() => []);
  const related = allItems.filter((i) => i.id !== item.id).slice(0, 4);

  const available = item.stock > 0;
  const nextAvailableAt = item.pendingHolds[0];
  const waMessage = encodeURIComponent(
    `Hola PanteraStore, quiero consultar por el item "${item.name}" (${itemSubtitle(item)}) publicado a ${formatPEN(item.price)}.`
  );

  return (
    <>
      <Header />
      <main className="pt-24 pb-24 lg:pb-20 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto min-h-screen hero-gradient">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-12 mt-8">
          {/* Imagen y detalles técnicos */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="relative aspect-square glass-card rounded-xl flex items-center justify-center p-8 overflow-hidden group">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="relative z-10 w-full h-full object-contain"
                />
              ) : (
                <ImagePlaceholder label={item.name} icon="category" className="relative z-10 w-full h-full" />
              )}
              <div className="absolute bottom-6 left-6 flex gap-2">
                <span className="bg-secondary/10 text-secondary font-label-caps text-label-caps px-3 py-1 rounded-full border border-secondary/20">
                  INTERCAMBIABLE
                </span>
                <span className="bg-primary/10 text-primary font-label-caps text-label-caps px-3 py-1 rounded-full border border-primary/20">
                  EDICIÓN LIMITADA
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card p-4 rounded-lg flex flex-col items-center text-center">
                <span className="text-on-surface-variant font-label-caps text-xs mb-1">
                  {item.category === "hero" ? "HÉROE" : "CATEGORÍA"}
                </span>
                <span className="font-headline-md text-sm">{itemSubtitle(item)}</span>
              </div>
              <div className="glass-card p-4 rounded-lg flex flex-col items-center text-center">
                <span className="text-on-surface-variant font-label-caps text-xs mb-1">SLOT</span>
                <span className="font-headline-md text-sm">Arma</span>
              </div>
              <div className="glass-card p-4 rounded-lg flex flex-col items-center text-center">
                <span className="text-on-surface-variant font-label-caps text-xs mb-1">ORIGEN</span>
                <span className="font-headline-md text-sm">Steam Market</span>
              </div>
              <div className="glass-card p-4 rounded-lg flex flex-col items-center text-center">
                <span className="text-on-surface-variant font-label-caps text-xs mb-1">CALIDAD</span>
                <span className="font-headline-md text-sm">{RARITY_LABEL[item.rarity]}</span>
              </div>
            </div>
          </div>

          {/* Info y CTA */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <div>
              <nav className="flex items-center gap-2 text-on-surface-variant font-label-caps text-[10px] mb-4">
                <Link href="/catalogo" className="hover:text-primary transition-colors">
                  CATÁLOGO
                </Link>
                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                <span className="text-on-surface">{RARITY_LABEL[item.rarity].toUpperCase()}</span>
              </nav>
              <h1 className="font-headline-xl text-headline-xl text-on-surface leading-tight mb-2">
                {item.name}
              </h1>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(233,195,73,0.8)]" />
                <span className="text-secondary font-headline-md text-lg tracking-widest">
                  {RARITY_LABEL[item.rarity].toUpperCase()}
                </span>
              </div>
            </div>

            <div className="bg-surface-container-high p-8 rounded-xl border border-white/5 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-on-surface-variant font-label-caps text-sm mb-1 uppercase">
                  Valor actual de mercado
                </p>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="font-price-display text-4xl text-on-surface">
                    {formatPEN(item.price)}
                  </span>
                  <span className="text-secondary font-body-sm text-sm">
                    ref. Steam: {formatPEN(item.marketPrice)}
                  </span>
                </div>

                {!available && (
                  <p className="mb-4 text-error font-body-sm">
                    {nextAvailableAt
                      ? `Agotado por ahora — disponible el ${new Date(nextAvailableAt).toLocaleDateString("es-PE")}.`
                      : "Agotado por ahora."}
                  </p>
                )}

                <div className="flex flex-col gap-3">
                  {available ? (
                    <a
                      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-4 bg-[#25D366] hover:bg-[#20bd5a] text-black font-headline-md text-headline-md flex items-center justify-center gap-2 rounded transition-all active:scale-[0.98]"
                    >
                      <span className="material-symbols-outlined">chat</span>
                      Consultar por WhatsApp
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-4 bg-white/5 text-on-surface-variant font-headline-md text-headline-md flex items-center justify-center gap-2 rounded cursor-not-allowed"
                    >
                      Agotado
                    </button>
                  )}
                  <button
                    type="button"
                    className="w-full py-4 border border-white/20 hover:border-white/40 hover:bg-white/5 text-on-surface font-headline-md text-headline-md rounded transition-all active:scale-[0.98]"
                  >
                    Agregar a favoritos
                  </button>
                </div>
                <p className="mt-4 text-on-surface-variant font-body-sm text-center italic">
                  Transacción segura. Coordinación de entrega en menos de 15 minutos por WhatsApp.
                </p>
              </div>
              <div className="absolute -right-12 -bottom-12 opacity-5 pointer-events-none">
                <span className="material-symbols-outlined text-[200px]">security</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="border-b border-white/10 pb-2">
                <h3 className="font-headline-md text-headline-md text-on-surface">
                  Descripción del Item
                </h3>
              </div>
              <div className="font-body-md text-body-md text-on-surface-variant leading-relaxed space-y-4">
                <p>
                  {item.category === "hero"
                    ? `Item cosmético original de ${item.hero}, verificado y listo para transferir por trade de Steam.`
                    : `${CATEGORY_LABEL[item.category]} original, verificado y listo para transferir por trade de Steam.`}{" "}
                  El precio se actualiza según el valor de referencia del Steam Market más el
                  margen de PanteraStore.
                </p>
                <ul className="space-y-2 font-label-caps text-xs">
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" /> ANIMACIÓN PERSONALIZADA
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" /> EFECTOS DE PARTÍCULAS
                    ÚNICOS
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" /> SONIDO AMBIENTAL EXCLUSIVO
                  </li>
                </ul>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <div className="flex justify-between items-center mb-6">
                <span className="font-headline-md text-sm">Tendencia de Precio</span>
                <span className="text-on-surface-variant font-label-caps text-[10px]">
                  ÚLTIMOS 30 DÍAS
                </span>
              </div>
              <div className="h-24 w-full flex items-end gap-1 px-2">
                {[60, 65, 62, 75, 82, 95].map((h, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 rounded-t transition-all cursor-help ${
                      idx === 5 ? "bg-secondary hover:brightness-110" : "bg-white/10 hover:bg-secondary/50"
                    }`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Piezas del set (solo si el ítem es un set abierto) */}
        {item.setPieces.length > 0 && (
          <section className="mt-24">
            <div className="flex justify-between items-end mb-8">
              <div>
                <p className="text-secondary font-label-caps text-xs mb-2">SET COMPLETO</p>
                <h2 className="font-headline-lg text-headline-lg">Piezas de este set</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {item.setPieces.map((piece) => (
                <div
                  key={piece.slot}
                  className="bg-surface-container rounded-lg border border-white/5 overflow-hidden"
                >
                  <div className="aspect-square p-4 flex items-center justify-center relative">
                    {piece.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={piece.imageUrl}
                        alt={piece.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImagePlaceholder label={piece.name} className="w-full h-full" />
                    )}
                  </div>
                  <div className="p-4 border-t border-white/5">
                    <p className="text-xs text-on-surface-variant font-label-caps mb-1 uppercase">
                      {piece.slot}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="font-headline-md text-sm truncate pr-2">{piece.name}</span>
                      <span className="font-price-display text-sm">{formatPEN(piece.price)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Relacionados */}
        <section className="mt-24">
          <div className="flex justify-between items-end mb-8">
            <div>
              <p className="text-secondary font-label-caps text-xs mb-2">SELECCIÓN DE COLECCIONISTAS</p>
              <h2 className="font-headline-lg text-headline-lg">También te puede interesar</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/catalogo/${r.id}`}
                className="bg-surface-container rounded-lg border border-white/5 hover:border-primary/30 transition-all group cursor-pointer overflow-hidden"
              >
                <div className="aspect-square p-4 flex items-center justify-center relative">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt={r.name} className="w-full h-full object-contain" />
                  ) : (
                    <ImagePlaceholder label={r.name} className="w-full h-full" />
                  )}
                  <div
                    className={`absolute top-2 right-2 text-[8px] font-bold px-2 py-0.5 rounded uppercase ${RARITY_BADGE_CLASS[r.rarity]}`}
                  >
                    {RARITY_LABEL[r.rarity]}
                  </div>
                </div>
                <div className="p-4 border-t border-white/5">
                  <p className="text-xs text-on-surface-variant font-label-caps mb-1 uppercase">
                    {itemSubtitle(r)}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="font-headline-md text-sm truncate pr-2">{r.name}</span>
                    <span className="font-price-display text-sm">{formatPEN(r.price)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
