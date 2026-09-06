import Link from "next/link";

const WHATSAPP_NUMBER = "51900000000"; // TODO: reemplazar por el número real de la empresa

export default function Footer() {
  return (
    <footer className="w-full mt-auto px-margin-mobile md:px-margin-desktop py-12 bg-surface-container-lowest border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-base">
      <div className="flex items-center gap-2">
        <span className="font-headline-md text-headline-md font-bold text-primary tracking-tighter text-lg">
          PANTERASTORE
        </span>
      </div>
      <nav className="flex flex-wrap justify-center gap-6">
        <Link
          href="/terminos"
          className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors"
        >
          Términos de Servicio
        </Link>
        <Link
          href="/privacidad"
          className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors"
        >
          Política de Privacidad
        </Link>
        <a
          href="https://steamcommunity.com/market/"
          target="_blank"
          rel="noreferrer"
          className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors"
        >
          Steam Market
        </a>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noreferrer"
          className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors"
        >
          Contactar Soporte
        </a>
      </nav>
    </footer>
  );
}
