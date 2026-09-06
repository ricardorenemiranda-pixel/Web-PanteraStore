import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import { ITEMS, RARITY_CLASS, RARITY_LABEL, RARITY_TEXT_CLASS, itemSubtitle } from "@/lib/mock-data";
import { formatPEN } from "@/lib/currency";

export default function HomePage() {
  const featured = ITEMS.slice(0, 4);

  return (
    <>
      <Header />
      <main className="pt-16 pb-24 lg:pb-0">
        {/* Hero */}
        <section className="relative w-full h-[600px] md:h-[720px] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <ImagePlaceholder
              label="Banner principal — héroes de Dota 2 en pose dramática"
              icon="landscape"
              className="w-full h-full opacity-60"
            />
            <div className="absolute inset-0 hero-gradient" />
          </div>
          <div className="relative z-10 px-margin-mobile md:px-margin-desktop max-w-4xl">
            <h1 className="font-headline-xl text-headline-xl mb-6 leading-tight">
              Compra y vende tus items de <span className="text-primary">Dota 2</span> al
              mejor precio
            </h1>
            <p className="font-body-lg text-body-lg text-on-tertiary-container mb-8 max-w-2xl">
              La tienda definitiva para coleccionistas peruanos. Transacciones rápidas,
              seguras y con las mejores tasas del mercado.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/catalogo"
                className="bg-primary-container text-on-primary font-headline-md text-body-md px-8 py-4 rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                Ver catálogo
                <span className="material-symbols-outlined">trending_flat</span>
              </Link>
              <Link
                href="/inventario"
                className="border border-white/30 text-on-surface font-headline-md text-body-md px-8 py-4 rounded-lg hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                Vende tus items
                <span className="material-symbols-outlined">sell</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Categorías rápidas */}
        <section className="py-16 px-margin-mobile md:px-margin-desktop">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              href="/catalogo"
              className="glass-card p-6 rounded-xl group cursor-pointer hover:border-primary/50 transition-all border border-transparent"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="material-symbols-outlined text-primary text-4xl">
                  auto_awesome
                </span>
                <span className="font-label-caps text-label-caps text-primary bg-primary/10 px-2 py-1 rounded">
                  240 ITEMS
                </span>
              </div>
              <h3 className="font-headline-md text-headline-md mb-2">Arcanas</h3>
              <p className="font-body-sm text-on-surface-variant">
                Modelos base alterados, animaciones personalizadas y efectos premium.
              </p>
            </Link>
            <Link
              href="/catalogo"
              className="glass-card p-6 rounded-xl group cursor-pointer hover:border-secondary/50 transition-all border border-transparent"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="material-symbols-outlined text-secondary text-4xl">
                  verified
                </span>
                <span className="font-label-caps text-label-caps text-secondary bg-secondary/10 px-2 py-1 rounded">
                  1,250 ITEMS
                </span>
              </div>
              <h3 className="font-headline-md text-headline-md mb-2">Inmortales</h3>
              <p className="font-body-sm text-on-surface-variant">
                Efectos de hechizo exclusivos de los compendios y tesoros de temporada.
              </p>
            </Link>
            <Link
              href="/catalogo"
              className="glass-card p-6 rounded-xl group cursor-pointer hover:border-white/50 transition-all border border-transparent"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="material-symbols-outlined text-on-surface text-4xl">
                  inventory_2
                </span>
                <span className="font-label-caps text-label-caps text-on-surface bg-white/10 px-2 py-1 rounded">
                  5,000+ ITEMS
                </span>
              </div>
              <h3 className="font-headline-md text-headline-md mb-2">Sets y Bundles</h3>
              <p className="font-body-sm text-on-surface-variant">
                Equipamiento completo para tus héroes favoritos en packs sellados.
              </p>
            </Link>
          </div>
        </section>

        {/* Items destacados */}
        <section className="py-16 px-margin-mobile md:px-margin-desktop bg-surface-container-low/30">
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="font-label-caps text-label-caps text-primary mb-2 block">
                MERCADO ACTIVO
              </span>
              <h2 className="font-headline-lg text-headline-lg">Items Destacados</h2>
            </div>
            <Link
              href="/catalogo"
              className="text-primary font-label-caps text-label-caps flex items-center gap-2 hover:underline transition-all"
            >
              VER TODO EL CATÁLOGO
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-gutter">
            {featured.map((item) => (
              <Link
                key={item.id}
                href={`/catalogo/${item.id}`}
                className={`bg-surface-container rounded-lg overflow-hidden border border-white/5 group ${RARITY_CLASS[item.rarity]} hover:-translate-y-2 transition-all duration-300`}
              >
                <div className="relative h-48 w-full bg-surface-container-high flex items-center justify-center p-4">
                  <ImagePlaceholder label={item.imageLabel} className="w-full h-full" />
                  <div className="absolute top-2 left-2">
                    <span className="font-label-caps text-[10px] bg-secondary/20 text-secondary border border-secondary/30 px-2 py-0.5 rounded">
                      EN VENTA
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <p className={`font-label-caps text-label-caps mb-1 ${RARITY_TEXT_CLASS[item.rarity]}`}>
                    {RARITY_LABEL[item.rarity]}
                  </p>
                  <h4 className="font-headline-md text-body-md mb-4 truncate">{item.name}</h4>
                  <div className="flex justify-between items-center">
                    <span className="font-body-sm text-on-surface-variant">{itemSubtitle(item)}</span>
                    <span className="font-price-display text-price-display text-on-surface">
                      {formatPEN(item.price)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Confianza */}
        <section className="py-20 px-margin-mobile md:px-margin-desktop border-t border-white/5">
          <div className="flex flex-wrap justify-center gap-12 md:gap-32 opacity-80">
            <div className="text-center">
              <div className="font-headline-lg text-headline-lg text-primary">+50k</div>
              <div className="font-label-caps text-label-caps text-on-surface-variant">
                TRADES EXITOSOS
              </div>
            </div>
            <div className="text-center">
              <div className="font-headline-lg text-headline-lg text-primary">24/7</div>
              <div className="font-label-caps text-label-caps text-on-surface-variant">
                SOPORTE EN VIVO
              </div>
            </div>
            <div className="text-center">
              <div className="font-headline-lg text-headline-lg text-primary">100%</div>
              <div className="font-label-caps text-label-caps text-on-surface-variant">
                SEGURO POR STEAM
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
