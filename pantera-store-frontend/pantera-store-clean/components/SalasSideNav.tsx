"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/salas", label: "Salas", icon: "sports_esports" },
  { href: "/comunidad", label: "Tabla de clasificación", icon: "leaderboard" },
  { href: "/billetera", label: "Mi billetera", icon: "account_balance_wallet" },
  { href: "/sanciones", label: "Mis sanciones", icon: "gavel" },
  { href: "/catalogo", label: "Tienda", icon: "storefront" },
  { href: "/como-funciona", label: "Cómo funciona", icon: "help" },
];

/** Navegación de la experiencia de Salas: solo enlaces a lo que ya existe y funciona. */
export default function SalasSideNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:flex flex-col gap-1 w-[220px] shrink-0">
      {ITEMS.map((item) => {
        const active = item.href === "/salas" ? pathname === "/salas" : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-2.5 font-body-sm transition-colors ${
              active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
