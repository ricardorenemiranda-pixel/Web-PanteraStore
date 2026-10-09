"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  SANCTION_TYPES,
  SANCTION_TYPE_LABEL,
  type SanctionItem,
  type SanctionType,
  applySanction,
  fetchAdminSanctions,
  revokeSanction,
} from "@/lib/trustApi";
import { centsToPEN } from "@/lib/walletApi";

const inputClass = "bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3 w-full";

const TYPE_CLASS: Record<SanctionType, string> = {
  warning: "text-secondary border-secondary/30 bg-secondary/10",
  fine: "text-error border-error/30 bg-error/10",
  suspension: "text-error border-error/30 bg-error/10",
};

function SanctionForm({ onApplied }: { onApplied: () => void }) {
  const params = useSearchParams();
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [type, setType] = useState<SanctionType>("warning");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [suspendedUntil, setSuspendedUntil] = useState("");
  const [reportId, setReportId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<SanctionItem | null>(null);

  useEffect(() => {
    const qUser = params?.get("userId");
    const qName = params?.get("userName");
    const qReport = params?.get("reportId");
    if (qUser) setUserId(qUser);
    if (qName) setUserName(qName);
    if (qReport) setReportId(qReport);
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setApplied(null);
    try {
      const sanction = await applySanction({
        userId: userId.trim(),
        type,
        reason: reason.trim(),
        amountCents: type === "fine" ? Math.round(Number(amount) * 100) : undefined,
        suspendedUntil: type === "suspension" && suspendedUntil ? new Date(suspendedUntil).toISOString() : undefined,
        reportId: reportId.trim() || undefined,
      });
      setApplied(sanction);
      setReason("");
      setAmount("");
      setSuspendedUntil("");
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aplicar la sanción.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface-card p-6 flex flex-col gap-4" style={{ borderRadius: 0 }}>
      <h2 className="font-headline-md text-headline-md text-on-surface">Aplicar sanción</h2>
      <label className="flex flex-col gap-1">
        <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">ID del usuario</span>
        <input className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="user-id" />
        {userName && <span className="font-body-sm text-on-surface-variant">{userName}</span>}
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Tipo</span>
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as SanctionType)}>
          {SANCTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {SANCTION_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      {type === "fine" && (
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Monto de la multa (S/)</span>
          <input className={inputClass} type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
      )}
      {type === "suspension" && (
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Suspendida hasta (vacío = indefinida)</span>
          <input className={inputClass} type="datetime-local" value={suspendedUntil} onChange={(e) => setSuspendedUntil(e.target.value)} />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Motivo</span>
        <textarea className={inputClass} rows={3} minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">ID del reporte de origen (opcional)</span>
        <input className={inputClass} value={reportId} onChange={(e) => setReportId(e.target.value)} />
      </label>
      {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}
      {applied && (
        <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 text-body-sm">
          Sanción aplicada. ID: <span className="figure-nums">{applied.id}</span>
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !userId.trim() || reason.trim().length < 5 || (type === "fine" && !amount)}
        className="bg-primary text-on-primary px-6 py-3 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Aplicando..." : "Aplicar sanción"}
      </button>
    </form>
  );
}

function AdminSancionesContent() {
  const { user, loading: userLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [sanctions, setSanctions] = useState<SanctionItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetchAdminSanctions()
      .then(setSanctions)
      .catch(() => setError("No se pudieron cargar las sanciones."));
  }, []);

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

  function revoke(s: SanctionItem) {
    const reason = window.prompt(`Motivo para revocar esta ${SANCTION_TYPE_LABEL[s.type].toLowerCase()} de ${s.userDisplayName}:`, "");
    if (!reason || reason.trim().length < 3) return;
    setBusy(s.id);
    setError("");
    revokeSanction(s.id, reason.trim())
      .then(load)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo revocar."))
      .finally(() => setBusy(null));
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
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-12 flex flex-col gap-10">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Sanciones</h1>
            <p className="text-on-surface-variant">
              Advertencias, multas (descuentan saldo real al instante) y suspensiones (bloquean salas), con registro
              de quién y por qué.
            </p>
          </div>

          <SanctionForm onApplied={load} />

          {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}

          <section>
            <h2 className="font-label-caps text-[10px] text-secondary uppercase tracking-wider mb-3">
              Todas las sanciones ({sanctions.length})
            </h2>
            <div className="flex flex-col gap-3">
              {sanctions.map((s) => (
                <article key={s.id} className="surface-card p-5 flex flex-col gap-2" style={{ borderRadius: 0 }}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`px-3 py-1 border font-label-caps text-[10px] uppercase ${TYPE_CLASS[s.type]}`}>
                      {SANCTION_TYPE_LABEL[s.type]}
                    </span>
                    <span className="font-body-md text-on-surface">{s.userDisplayName}</span>
                    {s.type === "fine" && s.amountCents !== null && (
                      <span className="font-body-sm text-on-surface-variant figure-nums">{centsToPEN(s.amountCents)}</span>
                    )}
                    {s.isActive && s.type === "suspension" && (
                      <span className="font-label-caps text-[10px] uppercase text-error">Activa</span>
                    )}
                    {s.revokedAt && <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Revocada</span>}
                    <span className="font-body-sm text-on-surface-variant ml-auto">{new Date(s.appliedAt).toLocaleString("es-PE")}</span>
                  </div>
                  <p className="font-body-sm text-on-surface">{s.reason}</p>
                  <p className="font-body-sm text-on-surface-variant">
                    ID: <span className="figure-nums text-on-surface">{s.id}</span> · Usuario: <span className="figure-nums text-on-surface">{s.userId}</span>
                    {s.reportId && <> · Reporte: <span className="figure-nums text-on-surface">{s.reportId}</span></>}
                  </p>
                  {s.revokedAt && s.revokeReason && <p className="font-body-sm text-primary">Revocada: {s.revokeReason}</p>}
                  {!s.revokedAt && (
                    <button type="button" disabled={busy === s.id} onClick={() => revoke(s)} className="self-start text-error font-label-caps text-[10px] uppercase hover:underline disabled:opacity-50">
                      Revocar
                    </button>
                  )}
                </article>
              ))}
              {sanctions.length === 0 && (
                <div className="surface-card p-5 text-on-surface-variant" style={{ borderRadius: 0 }}>
                  Todavía no se aplicó ninguna sanción.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function AdminSancionesPage() {
  return (
    <Suspense fallback={null}>
      <AdminSancionesContent />
    </Suspense>
  );
}
