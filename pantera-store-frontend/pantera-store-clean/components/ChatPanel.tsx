"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useChatLive } from "@/lib/useChatLive";

/**
 * El chat general en sí (lista de mensajes + input), sin la burbuja flotante
 * que lo envuelve en el resto del sitio — para poder incrustarlo también
 * como panel fijo dentro de una página (ver app/salas/page.tsx).
 */
export default function ChatPanel({
  title = "Chat general",
  className = "",
  onClose,
}: {
  title?: string;
  className?: string;
  onClose?: () => void;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const { messages, live, online, error, send, clearError } = useChatLive(!!user);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  if (!user) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    send(body);
    setDraft("");
  }

  return (
    <div className={`surface-card flex flex-col ${className}`} style={{ borderRadius: 0 }} role="dialog" aria-label={title}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-headline-md text-headline-md text-on-surface">{title}</span>
          {live && (
            <span className="flex items-center gap-1.5 font-label-caps text-[10px] text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {online} en línea
            </span>
          )}
          {!live && <span className="w-2 h-2 rounded-full bg-outline" title="Reconectando..." />}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Cerrar chat" className="text-on-surface-variant hover:text-on-surface text-xl leading-none">
            ×
          </button>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0">
        {messages.length === 0 && <p className="font-body-sm text-on-surface-variant">Todavía no hay mensajes. ¡Sé el primero!</p>}
        {messages.map((m) => (
          <div key={m.id} className="font-body-sm">
            <span className={`font-semibold ${m.userId === user.id ? "text-primary" : "text-on-surface"}`}>{m.displayName}</span>
            <span className="text-on-surface-variant">: </span>
            <span className="text-on-surface break-words">{m.body}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-4 mb-2 bg-error/10 border border-error/20 text-error px-3 py-2 text-body-sm flex justify-between gap-2 shrink-0">
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}

      <form onSubmit={submit} className="flex gap-2 p-3 border-t border-outline-variant shrink-0">
        <input
          className="flex-1 min-w-0 bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
          value={draft}
          maxLength={300}
          placeholder="Escribe un mensaje..."
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={!draft.trim()} className="shrink-0 bg-primary text-on-primary px-4 py-2 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50">
          Enviar
        </button>
      </form>
    </div>
  );
}
