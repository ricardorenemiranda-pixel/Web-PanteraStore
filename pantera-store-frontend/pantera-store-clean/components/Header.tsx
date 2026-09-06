"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const NAV_LINKS = [
  { href: "/catalogo", label: "Catálogo" },
  { href: "/inventario", label: "Vender mis items" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.push("/");
  }

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 bg-surface/80 backdrop-blur-xl border-b border-white/10 shadow-2xl">
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className="font-headline-md text-headline-md font-bold text-primary tracking-tighter"
        >
          PANTERASTORE
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
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
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors"
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <span className="material-symbols-outlined text-primary text-[22px]">
                  account_circle
                </span>
              )}
              <span className="font-body-sm text-body-sm text-on-surface hidden sm:inline">
                {user.displayName}
              </span>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                {menuOpen ? "expand_less" : "expand_more"}
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface-container border border-white/10 rounded-lg shadow-2xl overflow-hidden">
                <Link
                  href="/perfil"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-white/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Mi perfil
                </Link>
                <Link
                  href="/mis-compras"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-white/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  Mis compras
                </Link>
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-body-sm text-on-surface hover:bg-white/5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                    Panel de administración
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-body-sm text-error hover:bg-error/10 transition-colors border-t border-white/5"
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
            className="bg-primary-container text-on-primary hover:brightness-110 active:scale-95 transition-all px-4 py-2 rounded text-body-sm font-semibold flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            Iniciar sesión con Steam
          </Link>
        )}
      </div>
    </header>
  );
}
