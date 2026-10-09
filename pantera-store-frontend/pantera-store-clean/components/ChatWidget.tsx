"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import ChatPanel from "@/components/ChatPanel";

/**
 * Burbuja de chat general flotante, visible en todo el sitio para usuarios
 * con sesión iniciada — excepto en /salas, que ya tiene el chat incrustado
 * como panel fijo (ver app/salas/page.tsx) y no necesita la burbuja también.
 */
export default function ChatWidget() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!user || pathname?.startsWith("/salas")) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-40 flex flex-col items-end gap-3">
      {open && <ChatPanel className="w-[320px] max-w-[calc(100vw-2rem)] h-[420px]" onClose={() => setOpen(false)} />}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Cerrar chat" : "Abrir chat general"}
        className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg hover:brightness-110"
      >
        <span className="material-symbols-outlined text-2xl">{open ? "close" : "chat"}</span>
      </button>
    </div>
  );
}
