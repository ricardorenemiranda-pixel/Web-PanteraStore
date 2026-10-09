"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { type AuditLogEntry, fetchAuditLog } from "@/lib/trustApi";

const inputClass = "bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3 w-full";

export default function AdminAuditoriaPage() {
  const { user, loading: userLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchAuditLog({ actorId: actorId.trim() || undefined, action: action.trim() || undefined, limit: 200 })
      .then(setEntries)
      .catch(() => setError("No se pudo cargar la auditoría."))
      .finally(() => setLoading(false));
  }, [actorId, action]);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (userLoading) return <div className="min-h-screen bg-background" />;

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">{user ? "Tu cuenta no tiene permisos de administrador." : "Inicia sesión para continuar."}</p>
          <Link href={user ? "/" : "/login"} className="text-primary underline">
            {user ? "Volver al inicio" : "Iniciar sesión"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md">
      <header className="fixed top-0 left-0 w-full z-50 flex items-center gap-4 px-margin-mobile md:px-margin-desktop h-16 bg-surface/80 backdrop-blur-xl border-b border-on-surface/10">
        <Link href="/admin" className="flex items-center gap-1 font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver al panel
        </Link>
      </header>

      <main className="pt-16">
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-12 flex flex-col gap-8">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Auditoría</h1>
            <p className="text-on-surface-variant">
              Registro de solo lectura de acciones de administración de este módulo (sanciones, reportes, disputas).
              No cubre todavía otras acciones de admin de sprints anteriores (pagos, resultados de partida).
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            className="flex flex-wrap gap-3 items-end"
          >
            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">ID del admin</span>
              <input className={inputClass} value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="admin-1" />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Acción</span>
              <input className={inputClass} value={action} onChange={(e) => setAction(e.target.value)} placeholder="trust.dispute.uphold" />
            </label>
            <button type="submit" className="bg-primary text-on-primary px-6 py-2.5 font-label-caps text-label-caps hover:brightness-110">
              Filtrar
            </button>
          </form>

          {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}
          {loading && <p className="text-on-surface-variant">Cargando...</p>}

          {!loading && entries.length === 0 && (
            <div className="surface-card p-5 text-on-surface-variant" style={{ borderRadius: 0 }}>
              No hay entradas que coincidan con este filtro.
            </div>
          )}

          <div className="flex flex-col gap-2">
            {entries.map((e) => (
              <div key={e.id} className="surface-card px-4 py-3 flex flex-col gap-1" style={{ borderRadius: 0 }}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-label-caps text-[10px] uppercase text-primary border border-primary/30 bg-primary/10 px-2 py-1">
                    {e.action}
                  </span>
                  <span className="font-body-sm text-on-surface">{e.actorId}</span>
                  {e.targetType && (
                    <span className="font-body-sm text-on-surface-variant">
                      {e.targetType}: <span className="figure-nums text-on-surface">{e.targetId}</span>
                    </span>
                  )}
                  <span className="font-body-sm text-on-surface-variant ml-auto">{new Date(e.createdAt).toLocaleString("es-PE")}</span>
                </div>
                {e.metadata && Object.keys(e.metadata).length > 0 && (
                  <pre className="font-body-sm text-on-surface-variant whitespace-pre-wrap break-all">
                    {JSON.stringify(e.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
