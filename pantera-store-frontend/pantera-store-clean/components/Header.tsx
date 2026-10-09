"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const NAV_LINKS = [
  { href: "/catalogo", label: "Catálogo" },
  { href: "/salas", label: "Salas" },
  { href: "/comunidad", label: "Comunidad" },
  { href: "/inventario", label: "Vender mis items" },
  { href: "/como-funciona", label: "Cómo funciona" },
];

interface HeaderProps {
  /** El home tiene un hero a pantalla completa (video/imagen) detrás del
   * header — mientras estás sobre esa zona, el header va transparente
   * (se "pierde" en la imagen) y se oculta al bajar; al subir vuelve a
   * aparecer. En el resto de páginas el header se queda siempre sólido
   * y visible, como antes. */
  overHero?: boolean;
}

export default function Header({ overHero = false }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [transparent, setTransparent] = useState(overHero);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!overHero) return;

    function handleScroll() {
      const y = window.scrollY;
      const heroHeight = window.innerHeight * 0.85;

      setTransparent(y < heroHeight * 0.6);

      if (y <= heroHeight * 0.6) {
        setHidden(false);
      } else if (y > lastScrollY.current) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY.current = y;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [overHero]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.push("/");
  }

  const onImage = overHero && transparent;

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 transition-[background-color,border-color,transform] duration-300 ease-out ${
        hidden ? "-translate-y-full" : "translate-y-0"
      } ${
        onImage
          ? "bg-transparent border-b border-transparent"
          : "bg-surface/80 backdrop-blur-xl border-b border-on-surface/10"
      }`}
    >
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className={`font-headline-md text-headline-md font-bold ${onImage ? "text-white" : "text-primary"}`}
        >
          PANTERASTORE
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || (pathname ?? "").startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  onImage
                    ? active
                      ? "text-white border-b-2 border-white pb-1 font-body-md"
                      : "text-white/75 hover:text-white transition-colors font-body-md"
                    : active
                      ? "text-primary border-b-2 border-primary pb-1 font-body-md"
                      : "text-on-surface-variant hover:text-on-surface transition-colors font-body-md"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full transition-colors ${
                onImage
                  ? "bg-white/15 backdrop-blur-md border border-white/30 hover:bg-white/25"
                  : "bg-surface-container hover:bg-surface-container-high"
              }`}
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <span className={`material-symbols-outlined text-[22px] ${onImage ? "text-white" : "text-primary"}`}>
                  account_circle
                </span>
              )}
              <span className={`font-body-sm text-body-sm hidden sm:inline ${onImage ? "text-white" : "text-on-surface"}`}>
                {user.displayName}
              </span>
              <span className={`material-symbols-outlined text-[18px] ${onImage ? "text-white/80" : "text-on-surface-variant"}`}>
                {menuOpen ? "expand_less" : "expand_more"}
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface-container border border-on-surface/10 rounded-xl shadow-lg overflow-hidden">
                <Link
                  href="/perfil"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Mi perfil
                </Link>
                <Link
                  href="/mis-compras"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  Mis compras
                </Link>
                <Link
                  href="/mis-partidas"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">sports_esports</span>
                  Mis partidas
                </Link>
                <Link
                  href="/billetera"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                  Mi billetera
                </Link>
                <Link
                  href="/sanciones"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">gavel</span>
                  Mis sanciones
                </Link>
                {user.role === "admin" && (
                  <>
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                      Panel de administración
                    </Link>
                    <Link
                      href="/admin/billetera"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">savings</span>
                      Saldo de prueba
                    </Link>
                    <Link
                      href="/admin/partidas"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">sports_esports</span>
                      Partidas
                    </Link>
                    <Link
                      href="/admin/tesoreria"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">account_balance</span>
                      Tesorería
                    </Link>
                    <Link
                      href="/admin/reportes"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">flag</span>
                      Reportes
                    </Link>
                    <Link
                      href="/admin/sanciones"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">gavel</span>
                      Sanciones
                    </Link>
                    <Link
                      href="/admin/disputas"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">balance</span>
                      Disputas
                    </Link>
                    <Link
                      href="/admin/fraude"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">security</span>
                      Antifraude
                    </Link>
                    <Link
                      href="/admin/auditoria"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-on-surface/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">history</span>
                      Auditoría
                    </Link>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-body-sm text-error hover:bg-error/10 transition-colors border-t border-on-surface/5"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className={`hover:brightness-110 active:scale-95 transition-all px-4 py-2 rounded-full text-body-sm font-semibold flex items-center gap-2 ${
              onImage ? "bg-white/15 backdrop-blur-md border border-white/30 text-white" : "bg-primary text-on-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            Iniciar sesión con Steam
          </Link>
        )}
      </div>
    </header>
  );
}
