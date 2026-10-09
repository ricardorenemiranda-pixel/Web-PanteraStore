import fs from "fs";
import path from "path";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import Reveal from "@/components/Reveal";

const WHATSAPP_NUMBER = "51900000000"; // TODO: reemplazar por el número real de la empresa

// TODO: reemplazar por los enlaces reales de cada red.
const SOCIALS = [
  { slug: "discord", label: "Discord", href: "https://discord.gg/", color: "#5865F2" },
  { slug: "whatsapp", label: "WhatsApp", href: `https://wa.me/${WHATSAPP_NUMBER}`, color: "#25D366" },
  { slug: "tiktok", label: "TikTok", href: "https://www.tiktok.com/", color: "#FE2C55" },
  { slug: "kick", label: "Kick", href: "https://kick.com/", color: "#53FC18" },
  { slug: "facebook", label: "Facebook", href: "https://www.facebook.com/", color: "#1877F2" },
];

const BUY_STEPS = [
  { file: "comprar-1.jpg", icon: "search", title: "Elige tu item" },
  { file: "comprar-2.jpg", icon: "chat", title: "Coordina por WhatsApp" },
  { file: "comprar-3.jpg", icon: "swap_horiz", title: "Recíbelo por trade" },
];

const SELL_STEPS = [
  { file: "vender-1.jpg", icon: "login", title: "Entra con Steam" },
  { file: "vender-2.jpg", icon: "checklist", title: "Elige qué vender" },
  { file: "vender-3.jpg", icon: "payments", title: "Cobra tu recompra" },
];

const GALLERY = [
  { file: "galeria-1.jpg", icon: "image", span: "col-span-2 row-span-2" },
  { file: "galeria-2.jpg", icon: "image", span: "" },
  { file: "galeria-3.jpg", icon: "image", span: "" },
  { file: "galeria-4.jpg", icon: "image", span: "" },
  { file: "galeria-5.jpg", icon: "image", span: "" },
  { file: "galeria-6.jpg", icon: "image", span: "col-span-2" },
];

const FAQ = [
  {
    q: "¿Cómo se calcula el precio de un item?",
    a: "Parte del valor del Steam Community Market más un margen fijo de PanteraStore. En cada item ves ambos números.",
  },
  {
    q: "¿Necesito dar mi contraseña de Steam?",
    a: "No. Inicias sesión por el sistema oficial de Steam (OAuth) y el intercambio se hace por trade.",
  },
  {
    q: "¿Qué es el Trade URL?",
    a: "El enlace que genera Steam para recibir ofertas sin ser amigo. Lo guardas una vez en tu perfil.",
  },
  {
    q: "¿Qué métodos de pago aceptan?",
    a: "Se coordina por WhatsApp según lo que tengas disponible.",
  },
  {
    q: "¿Tiene algún costo usar la plataforma?",
    a: "No. El margen ya está incluido en el precio publicado.",
  },
];

const MEDIA_DIR = path.join(process.cwd(), "public", "media", "como-funciona");

function mediaUrl(file: string): string | null {
  try {
    return fs.existsSync(path.join(MEDIA_DIR, file)) ? `/media/como-funciona/${file}` : null;
  } catch {
    return null;
  }
}

function MediaSlot({
  file,
  icon,
  alt,
  className = "",
}: {
  file: string;
  icon: string;
  alt: string;
  className?: string;
}) {
  const url = mediaUrl(file);
  return (
    <div className={`relative overflow-hidden bg-surface-container ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-container-high to-background">
          <span className="material-symbols-outlined text-primary/40 text-[56px]">{icon}</span>
        </div>
      )}
    </div>
  );
}

function StepRow({ title, steps }: { title: string; steps: typeof BUY_STEPS }) {
  return (
    <section className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
      <h2 className="font-headline-lg text-headline-md text-on-surface mb-8">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, i) => (
          <div key={step.file} className="surface-card group" style={{ borderRadius: 0 }}>
            <div className="relative">
              <MediaSlot file={step.file} icon={step.icon} alt={step.title} className="aspect-[4/3]" />
              <span className="absolute top-3 left-3 w-9 h-9 flex items-center justify-center bg-primary text-on-primary font-label-caps text-label-caps">
                {i + 1}
              </span>
            </div>
            <h3 className="font-headline-md text-[20px] text-on-surface p-5">{step.title}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ComoFuncionaPage() {
  return (
    <>
      <Header />
      <main className="pt-24 pb-24 lg:pb-20 flex flex-col gap-20">
        <section className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full pt-8">
          <div className="relative overflow-hidden min-h-[22rem] md:min-h-[28rem] flex items-end">
            <MediaSlot file="hero.jpg" icon="play_circle" alt="PanteraStore" className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="relative p-8 md:p-12">
              <h1 className="font-headline-xl text-headline-lg-mobile md:text-headline-xl text-on-surface">
                Cómo funciona
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant mt-3">
                Comprar o vender en tres pasos.
              </p>
            </div>
          </div>
        </section>

        <Reveal>
          <StepRow title="Comprar" steps={BUY_STEPS} />
        </Reveal>

        <Reveal>
          <StepRow title="Vender" steps={SELL_STEPS} />
        </Reveal>

        <Reveal>
          <section className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
            <h2 className="font-headline-lg text-headline-md text-on-surface mb-8">Nuestra comunidad</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[9rem] md:auto-rows-[11rem] gap-3">
              {GALLERY.map((tile) => (
                <MediaSlot
                  key={tile.file}
                  file={tile.file}
                  icon={tile.icon}
                  alt="Comunidad PanteraStore"
                  className={tile.span}
                />
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
            <h2 className="font-headline-lg text-headline-md text-on-surface mb-8">Síguenos</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {SOCIALS.map((social) => (
                <a
                  key={social.slug}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  className="social-tile surface-card flex flex-col items-center justify-center gap-4 py-10"
                  style={{ borderRadius: 0, ["--brand" as string]: social.color }}
                >
                  <span
                    aria-hidden="true"
                    className="social-tile-icon block w-14 h-14"
                    style={{
                      maskImage: `url(/icons/social/${social.slug}.svg)`,
                      WebkitMaskImage: `url(/icons/social/${social.slug}.svg)`,
                    }}
                  />
                  <span className="font-label-caps text-label-caps text-on-surface-variant">
                    {social.label}
                  </span>
                </a>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="px-margin-mobile md:px-margin-desktop max-w-3xl mx-auto w-full">
            <h2 className="font-headline-lg text-headline-md text-on-surface mb-6">Preguntas rápidas</h2>
            <div className="flex flex-col divide-y divide-outline-variant border-y border-outline-variant">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-body-md font-semibold text-on-surface">
                    {item.q}
                    <span className="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform">
                      expand_more
                    </span>
                  </summary>
                  <p className="font-body-md text-on-surface-variant mt-3 max-w-[65ch]">{item.a}</p>
                </details>
              ))}
            </div>
            <p className="font-body-sm text-on-surface-variant mt-6">
              Más ayuda en{" "}
              <Link href="/contacto" className="text-primary underline">
                contacto y soporte
              </Link>
              .
            </p>
          </section>
        </Reveal>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
