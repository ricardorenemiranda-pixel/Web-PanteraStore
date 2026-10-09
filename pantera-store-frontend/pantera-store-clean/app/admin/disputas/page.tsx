"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import {
  DISPUTE_STATUS_LABEL,
  type DisputeItem,
  fetchAdminDisputes,
  fetchDisputeEvidenceUrl,
  rejectDispute,
  upholdDispute,
} from "@/lib/trustApi";

const STATUS_CLASS: Record<DisputeItem["status"], string> = {
  pending: "text-secondary border-secondary/30 bg-secondary/10",
  upheld: "text-error border-error/30 bg-error/10",
  rejected: "text-on-surface-variant border-outline-variant",
};

function EvidenceButton({ disputeId }: { disputeId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <div>
      {!url ? (
        <button
          type="button"
          onClick={() => fetchDisputeEvidenceUrl(disputeId).then(setUrl).catch(() => setError("No se pudo cargar la evidencia."))}
          className="text-primary underline font-body-sm"
        >
          Ver evidencia
        </button>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Evidencia de la disputa" className="max-h-72 border border-outline-variant" />
      )}
      {error && <p className="text-error font-body-sm">{error}</p>}
    </div>
  );
}

export default function AdminDisputasPage() {
  const { user, loading: userLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [view, setView] = useState<"pending" | "all">("pending");
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetchAdminDisputes(view)
      .then(setDisputes)
      .catch(() => setError("No se pudieron cargar las disputas."));
  }, [view]);

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin, load]);

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

  async function act(id: string, work: () => Promise<unknown>) {
    setBusy(id);
    setError("");
    try {
      await work();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusy(null);
    }
  }

  function uphold(d: DisputeItem) {
    if (
      !window.confirm(
        `¿Aceptar la disputa de ${d.raisedByDisplayName}? Esto revierte TODA la liquidación de la partida: cada jugador recupera su entrada, quien ganó pierde el premio y la plataforma devuelve su comisión. No se puede deshacer.`,
      )
    )
      return;
    const note = window.prompt("Nota de resolución (opcional):", "") ?? "";
    void act(d.id, () => upholdDispute(d.id, note));
  }

  function reject(d: DisputeItem) {
    const note = window.prompt(`Motivo para rechazar la disputa de ${d.raisedByDisplayName}:`, "");
    if (!note || note.trim().length < 3) return;
    void act(d.id, () => rejectDispute(d.id, note.trim()));
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
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Disputas de resultado</h1>
            <p className="text-on-surface-variant">
              Aceptar revierte el pago completo de la partida (nadie gana, todos recuperan su entrada). No se
              redeclara un ganador distinto.
            </p>
          </div>

          <div className="flex gap-2">
            {(["pending", "all"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-5 py-2 font-label-caps text-label-caps border transition-colors ${
                  view === v ? "bg-primary text-on-primary border-primary" : "border-outline-variant text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {v === "pending" ? "Pendientes" : "Todas"}
              </button>
            ))}
          </div>

          {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}

          {disputes.length === 0 && (
            <div className="surface-card p-5 text-on-surface-variant" style={{ borderRadius: 0 }}>
              No hay disputas {view === "pending" ? "pendientes" : "registradas"}.
            </div>
          )}

          <div className="flex flex-col gap-3">
            {disputes.map((d) => (
              <article key={d.id} className="surface-card p-5 flex flex-col gap-3" style={{ borderRadius: 0 }}>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className={`px-3 py-1 border font-label-caps text-[10px] uppercase ${STATUS_CLASS[d.status]}`}>
                    {DISPUTE_STATUS_LABEL[d.status]}
                  </span>
                  <span className="font-body-sm text-on-surface-variant">{new Date(d.createdAt).toLocaleString("es-PE")}</span>
                </div>
                <p className="font-body-md text-on-surface">
                  <span className="font-semibold">{d.raisedByDisplayName}</span> impugnó la partida{" "}
                  <span className="figure-nums">{d.matchId}</span>
                </p>
                <p className="font-body-sm text-on-surface-variant">{d.reason}</p>
                {d.hasEvidence && <EvidenceButton disputeId={d.id} />}
                {d.resolutionNote && <p className="font-body-sm text-primary">Resolución: {d.resolutionNote}</p>}
                {d.status === "pending" && (
                  <div className="flex gap-3">
                    <button type="button" disabled={busy === d.id} onClick={() => uphold(d)} className="bg-error text-on-error px-5 py-2 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50">
                      Aceptar (revertir pago)
                    </button>
                    <button type="button" disabled={busy === d.id} onClick={() => reject(d)} className="border border-outline text-on-surface px-5 py-2 font-label-caps text-label-caps hover:bg-on-surface/5 disabled:opacity-50">
                      Rechazar
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
