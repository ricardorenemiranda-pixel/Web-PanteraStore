import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full mt-auto px-margin-mobile md:px-margin-desktop py-12 bg-surface-container-lowest border-t border-on-surface/5 flex flex-col md:flex-row justify-between items-center gap-base">
      <div className="flex items-center gap-2">
        <span className="font-headline-md text-headline-md font-bold text-primary text-lg">
          PANTERASTORE
        </span>
      </div>
      <nav className="flex flex-wrap justify-center gap-6">
        <Link
          href="/como-funciona"
          className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors"
        >
          Cómo funciona
        </Link>
        <Link
          href="/contacto"
          className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors"
        >
          Contacto y soporte
        </Link>
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
      </nav>
    </footer>
  );
}
