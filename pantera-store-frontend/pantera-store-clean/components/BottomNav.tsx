"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/catalogo", label: "Catálogo", icon: "storefront" },
  { href: "/inventario", label: "Vender", icon: "sell" },
  { href: "/login", label: "Perfil", icon: "account_circle" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-16 px-4 pb-safe bg-surface-container-highest/95 backdrop-blur-lg border-t border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      {ITEMS.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "flex flex-col items-center justify-center text-primary active:scale-90 duration-200"
                : "flex flex-col items-center justify-center text-on-tertiary-container hover:text-primary active:scale-90 duration-200"
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="font-label-caps text-[10px] mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
