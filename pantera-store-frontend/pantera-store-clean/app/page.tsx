import fs from "fs";
import path from "path";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import Reveal from "@/components/Reveal";
import HeroMarquee from "@/components/HeroMarquee";
import TopItemsMarquee from "@/components/TopItemsMarquee";
import { fetchCatalogItems } from "@/lib/catalogApi";

// Fotos/videos reales van en public/media/home/ (ver README.txt ahí) — se
// detectan solos por nombre de archivo, sin tener que tocar este código
// de nuevo cuando alguien los suba.
const HOME_MEDIA_DIR = path.join(process.cwd(), "public", "media", "home");
function homeMediaExists(filename: string): boolean {
  try {
    return fs.existsSync(path.join(HOME_MEDIA_DIR, filename));
  } catch {
    return false;
  }
}

// De Heraldo a Inmortal, en una sola fila — el tamaño y la altura de
// cada ícono crecen en curva hacia el final, como una media luna que
// termina en su punta más alta (Inmortal).
const RANKS = [
  { slug: "herald", label: "Heraldo" },
  { slug: "guardian", label: "Guardián" },
  { slug: "crusader", label: "Cruzado" },
  { slug: "archon", label: "Arconte" },
  { slug: "legend", label: "Leyenda" },
  { slug: "ancient", label: "Ancestro" },
  { slug: "divine", label: "Divino" },
  { slug: "immortal", label: "Inmortal" },
];
const RANK_MIN_SIZE = 3.5; // rem
const RANK_MAX_SIZE = 8; // rem
const RANK_MAX_LIFT = 6.5; // rem — cuánto sube el último respecto al primero

export default async function HomePage() {
  const hasHeroVideo = homeMediaExists("hero.mp4");
  const hasHeroPoster = homeMediaExists("hero-poster.jpg");
  const hasRanksBackground = homeMediaExists("ranks-bg.jpg");

  const allItems = await fetchCatalogItems().catch(() => []);
  const topItems = [...allItems].sort((a, b) => b.price - a.price).slice(0, 10);

  const rankCurve = RANKS.map((rank, i) => {
    // Curva que acelera hacia el final (t^1.6) — sube poco al principio
    // y se dispara cerca de Inmortal, en vez de una rampa recta.
    const t = i / (RANKS.length - 1);
    const curve = Math.pow(t, 1.6);
    return {
      ...rank,
      size: RANK_MIN_SIZE + (RANK_MAX_SIZE - RANK_MIN_SIZE) * curve,
      lift: RANK_MAX_LIFT * curve,
      iconUrl: homeMediaExists(`ranks/${rank.slug}.png`) ? `/media/home/ranks/${rank.slug}.png` : null,
    };
  });

  return (
    <>
      <Header overHero={hasHeroVideo} />
      <main className="pb-24 lg:pb-0">
        {/* Hero a pantalla completa — video de fondo, texto superpuesto en
            su propio bloque. El header (fixed, fuera de este flujo) va
            transparente encima mientras esta sección está a la vista. */}
        <section className="relative w-full min-h-[100dvh] flex items-center justify-center overflow-hidden">
          {hasHeroVideo ? (
            <video
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              poster={hasHeroPoster ? "/media/home/hero-poster.jpg" : undefined}
            >
              <source src="/media/home/hero.mp4" type="video/mp4" />
            </video>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-[#3a2f5c] to-[#14101f]" />
          )}
          {/* Capa oscura general — más fuerte que antes, para que el
              título resalte incluso fusionado con el video. */}
          <div className="absolute inset-0 bg-black/45" />
          {/* Viñeta radial centrada, justo donde va el texto. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 50% 46%, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 55%, transparent 80%)",
            }}
          />
          {/* Fundido final — el video se "derrite" hacia el color real de
              fondo de la página en vez de cortar en seco contra la
              siguiente sección. */}
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-background to-transparent" />

          <div className="relative z-10 w-full max-w-3xl mx-auto px-margin-mobile text-center">
            <h1
              className="hero-title-drop font-headline-xl text-headline-lg-mobile md:text-headline-xl lg:text-[80px] lg:leading-[1.02] text-white text-balance"
              style={{ mixBlendMode: "overlay" }}
            >
              ¿Estás listo para la batalla?
            </h1>
            <p className="hero-sub-drop font-body-lg text-body-lg text-white/85 mt-6 max-w-[46ch] mx-auto">
              Únete a las salas de la comunidad y prueba tu talento contra otros jugadores de
              Dota 2.
            </p>
            <div className="hero-cta-drop flex flex-col sm:flex-row gap-3 mt-10 justify-center">
              <Link
                href="/salas"
                className="bg-transparent border border-white/60 text-white font-medium text-body-md px-8 py-3.5 rounded-full flex items-center justify-center gap-2 transition-colors duration-300 hover:bg-primary/20 hover:border-primary/70 active:scale-[0.97]"
              >
                Unirme ahora
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Muro de héroes — carrusel infinito, varias filas en direcciones
            alternadas. Mismos íconos que ya usa el filtro de héroes del
            catálogo, sin assets nuevos. */}
        <Reveal>
          <section className="py-24 max-w-container-max mx-auto">
            <div className="text-center mb-10 px-margin-mobile md:px-margin-desktop">
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-3">
                Todo el roster, cubierto
              </h2>
              <p className="font-body-md text-on-surface-variant max-w-[52ch] mx-auto mb-6">
                127 héroes de Dota 2 — si tiene un cosmético, hay buenas chances de que lo tengamos
                o te lo compremos.
              </p>
              <Link
                href="/catalogo"
                className="inline-flex items-center gap-2 border border-outline text-on-surface font-medium text-body-sm px-6 py-3 rounded-full hover:bg-white/5 transition-colors"
              >
                Ver catálogo completo
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>
            <HeroMarquee />
          </section>
        </Reveal>

        {/* Los más valiosos — items reales del catálogo, de mayor a menor
            precio. Llena el hueco que dejaba la página sin ningún item
            visible fuera del catálogo. */}
        {topItems.length > 0 && (
          <Reveal>
            <section className="py-24 max-w-container-max mx-auto">
              <div className="flex justify-between items-end mb-10 px-margin-mobile md:px-margin-desktop">
                <div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">
                    Los más valiosos
                  </h2>
                  <p className="font-body-md text-on-surface-variant max-w-[52ch]">
                    Los items de mayor precio disponibles ahora mismo en el catálogo.
                  </p>
                </div>
                <Link
                  href="/catalogo"
                  className="hidden sm:inline-flex items-center gap-2 border border-outline text-on-surface font-medium text-body-sm px-6 py-3 rounded-full hover:bg-white/5 transition-colors shrink-0 ml-4"
                >
                  Ver catálogo
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
              <TopItemsMarquee items={topItems} />
            </section>
          </Reveal>
        )}

        {/* Medallas — refuerza el mensaje de Salas: sin importar tu rango,
            la comunidad es grande. Los íconos son arte oficial de Valve;
            se detectan solos si los subes a public/media/home/ranks/
            (ver README.txt ahí), y mientras tanto se ve un círculo con
            la inicial del rango para no dejar el layout roto. Fondo
            opcional (ranks-bg.jpg) con velo oscuro para que el texto y
            los íconos blancos sigan leyéndose sea cual sea la imagen. */}
        <Reveal>
          <section
            className="relative py-24 px-margin-mobile md:px-margin-desktop border-t border-outline-variant overflow-hidden"
            style={
              hasRanksBackground
                ? { backgroundImage: "url(/media/home/ranks-bg.jpg)", backgroundSize: "cover", backgroundPosition: "center" }
                : undefined
            }
          >
            {hasRanksBackground && (
              <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
            )}
            <div className="relative max-w-container-max mx-auto text-center">
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-3">
                Siempre hay una sala para tu medalla
              </h2>
              <p className="font-body-md text-on-surface-variant max-w-[56ch] mx-auto mb-12">
                No hace falta ser Inmortal — nuestra comunidad es grande, así que sea cual sea
                tu medalla, vas a encontrar salas con jugadores de tu mismo nivel.
              </p>
              <div className="overflow-x-auto" style={{ paddingTop: `${RANK_MAX_LIFT + 1}rem` }}>
                <div className="flex items-end justify-center gap-4 md:gap-6 min-w-max px-4 pb-2">
                  {rankCurve.map((rank) => (
                    <div
                      key={rank.slug}
                      className="flex flex-col items-center gap-3"
                      style={{ transform: `translateY(-${rank.lift}rem)` }}
                    >
                      {rank.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rank.iconUrl}
                          alt={rank.label}
                          className="object-contain"
                          style={{ width: `${rank.size}rem`, height: `${rank.size}rem` }}
                        />
                      ) : (
                        <div
                          className="rounded-full bg-surface-container border border-outline-variant flex items-center justify-center shrink-0"
                          style={{ width: `${rank.size}rem`, height: `${rank.size}rem` }}
                        >
                          <span className="font-headline-md text-on-surface-variant">{rank.label[0]}</span>
                        </div>
                      )}
                      <span className="font-body-sm text-sm text-on-surface-variant whitespace-nowrap">
                        {rank.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
