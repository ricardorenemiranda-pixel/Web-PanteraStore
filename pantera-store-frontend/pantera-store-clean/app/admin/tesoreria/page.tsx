"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import {
  type AdminDeposit,
  type AdminWithdrawal,
  type AlertItem,
  METHOD_LABEL,
  RISK_LABEL,
  type Treasury,
  approveDeposit,
  fetchAdminRequests,
  fetchAlerts,
  fetchProofObjectUrl,
  fetchTreasury,
  payWithdrawal,
  rejectDeposit,
  rejectWithdrawal,
  resolveAlert,
} from "@/lib/paymentsApi";
import { centsToPEN } from "@/lib/walletApi";

function Stat({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "good" | "bad" }) {
  return (
    <div className="surface-card p-4" style={{ borderRadius: 0 }}>
      <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">{label}</span>
      <p className={`font-headline-md text-headline-md figure-nums ${tone === "good" ? "text-primary" : tone === "bad" ? "text-error" : "text-on-surface"}`}>{value}</p>
      {hint && <p className="font-body-sm text-on-surface-variant">{hint}</p>}
    </div>
  );
}

function Flags({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((f) => (
        <span key={f} className="bg-error/10 border border-error/20 text-error px-2 py-0.5 font-label-caps text-[10px] uppercase">
          {RISK_LABEL[f] ?? f}
        </span>
      ))}
    </div>
  );
}

function ProofButton({ depositId }: { depositId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <div>
      {!url ? (
        <button
          type="button"
          onClick={() => fetchProofObjectUrl(depositId).then(setUrl).catch(() => setError("No se pudo cargar el comprobante."))}
          className="text-primary underline font-body-sm"
        >
          Ver comprobante
        </button>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Comprobante de pago" className="max-h-72 border border-outline-variant" />
      )}
      {error && <p className="text-error font-body-sm">{error}</p>}
    </div>
  );
}

export default function TreasuryPage() {
  const { user, loading: userLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    Promise.all([fetchTreasury(), fetchAlerts(), fetchAdminRequests("pending")])
      .then(([t, a, r]) => {
        setTreasury(t);
        setAlerts(a);
        setDeposits(r.deposits);
        setWithdrawals(r.withdrawals);
      })
      .catch(() => setError("No se pudo cargar la tesorería."));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
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

  function approve(d: AdminDeposit) {
    if (!window.confirm(`¿Confirmas que YA VISTE llegar ${centsToPEN(d.amountCents)} por ${METHOD_LABEL[d.method]} (operación ${d.operationCode}) a tu cuenta? Se acreditará el saldo a ${d.userDisplayName}.`)) return;
    void act(d.id, () => approveDeposit(d.id));
  }

  function reject(kind: "deposit" | "withdrawal", id: string) {
    const reason = window.prompt("Motivo del rechazo (lo verá el jugador):");
    if (!reason || reason.trim().length < 3) return;
    void act(id, () => (kind === "deposit" ? rejectDeposit(id, reason.trim()) : rejectWithdrawal(id, reason.trim())));
  }

  function pay(w: AdminWithdrawal) {
    const ref = window.prompt(
      `Transfiere ${centsToPEN(w.amountCents)} por ${METHOD_LABEL[w.method]} a ${w.destination} (titular: ${w.holderName}).\n\nCuando lo hayas hecho, escribe el número de operación de TU pago:`,
    );
    if (!ref || ref.trim().length < 4) return;
    void act(w.id, () => payWithdrawal(w.id, ref.trim()));
  }

  const t = treasury;

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md">
      <header className="fixed top-0 left-0 w-full z-50 flex items-center gap-4 px-margin-mobile md:px-margin-desktop h-16 bg-surface/80 backdrop-blur-xl border-b border-on-surface/10">
        <Link href="/admin" className="flex items-center gap-1 font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver al panel
        </Link>
      </header>

      <main className="pt-16">
        <div className="max-w-5xl mx-auto px-margin-mobile md:px-margin-desktop py-12 flex flex-col gap-10">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Tesorería</h1>
            <p className="text-on-surface-variant">
              Aquí revisas y confirmas las recargas y los retiros. Nunca acredites una recarga sin ver el dinero en tu cuenta.
            </p>
          </div>

          {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}

          {t && (
            <section>
              <h2 className="font-label-caps text-[10px] text-secondary uppercase tracking-wider mb-3">Resumen</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Entró (recargas)" value={centsToPEN(t.deposits.approvedCents)} hint={`${t.deposits.approvedCount} recargas · 24 h: ${centsToPEN(t.deposits.approvedLast24hCents)}`} tone="good" />
                <Stat label="Salió (retiros pagados)" value={centsToPEN(t.withdrawals.paidCents)} hint={`${t.withdrawals.paidCount} retiros · 24 h: ${centsToPEN(t.withdrawals.paidLast24hCents)}`} />
                <Stat label="Recargas por revisar" value={centsToPEN(t.deposits.pendingCents)} hint={`${t.deposits.pendingCount} pendientes`} />
                <Stat label="Retiros por pagar" value={centsToPEN(t.withdrawals.pendingCents)} hint={`${t.withdrawals.pendingCount} pendientes`} />
                <Stat label="Deben los jugadores" value={centsToPEN(t.wallets.playersCents)} hint={`Disponible ${centsToPEN(t.wallets.playersAvailableCents)} · bloqueado ${centsToPEN(t.wallets.playersLockedCents)}`} />
                <Stat label="Comisión ganada" value={centsToPEN(t.wallets.platformCents)} hint="Caja de la plataforma" tone="good" />
                <Stat label="Saldo de prueba / ajustes" value={centsToPEN(t.adjustmentsNetCents)} hint="No es dinero real" />
                <Stat
                  label="¿Cuadra el dinero?"
                  value={t.discrepancyCents === 0 ? "Sí" : `Diferencia ${centsToPEN(t.discrepancyCents)}`}
                  hint="Billeteras = entró − salió"
                  tone={t.discrepancyCents === 0 ? "good" : "bad"}
                />
              </div>
            </section>
          )}

          <section>
            <h2 className="font-label-caps text-[10px] text-secondary uppercase tracking-wider mb-3">Alertas ({alerts.length})</h2>
            {alerts.length === 0 ? (
              <div className="surface-card p-5 text-on-surface-variant" style={{ borderRadius: 0 }}>
                Sin movimientos raros por ahora.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {alerts.map((a) => (
                  <div key={a.id} className={`surface-card px-4 py-3 flex items-start gap-3 border-l-4 ${a.severity === "high" ? "border-l-error" : "border-l-secondary"}`} style={{ borderRadius: 0 }}>
                    <span className={`font-label-caps text-[10px] uppercase mt-0.5 ${a.severity === "high" ? "text-error" : "text-secondary"}`}>{a.severity === "high" ? "Grave" : "Revisar"}</span>
                    <div className="flex-1">
                      <p className="font-body-sm text-on-surface">{a.message}</p>
                      <p className="font-body-sm text-on-surface-variant">{new Date(a.at).toLocaleString("es-PE")}</p>
                    </div>
                    {a.resolvable && (
                      <button type="button" disabled={busy === a.id} onClick={() => act(a.id, () => resolveAlert(a.id))} className="font-label-caps text-[10px] uppercase text-primary hover:underline">
                        Marcar resuelta
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-label-caps text-[10px] text-secondary uppercase tracking-wider mb-3">Recargas por revisar ({deposits.length})</h2>
            {deposits.length === 0 && (
              <div className="surface-card p-5 text-on-surface-variant" style={{ borderRadius: 0 }}>
                No hay recargas pendientes.
              </div>
            )}
            <div className="flex flex-col gap-3">
              {deposits.map((d) => (
                <article key={d.id} className="surface-card p-5 flex flex-col gap-3" style={{ borderRadius: 0 }}>
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                    <span className="font-headline-md text-headline-md text-primary figure-nums">{centsToPEN(d.amountCents)}</span>
                    <span className="text-on-surface">{d.userDisplayName}</span>
                    <span className="font-body-sm text-on-surface-variant">
                      {METHOD_LABEL[d.method]} · operación <span className="figure-nums text-on-surface">{d.operationCode}</span> · {new Date(d.createdAt).toLocaleString("es-PE")}
                    </span>
                  </div>
                  <Flags flags={d.riskFlags} />
                  <ProofButton depositId={d.id} />
                  <div className="flex gap-3">
                    <button type="button" disabled={busy === d.id} onClick={() => approve(d)} className="bg-primary text-on-primary px-5 py-2 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50">
                      Ya llegó: acreditar
                    </button>
                    <button type="button" disabled={busy === d.id} onClick={() => reject("deposit", d.id)} className="text-error px-4 py-2 font-label-caps text-label-caps hover:bg-error/10 disabled:opacity-50">
                      Rechazar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-label-caps text-[10px] text-secondary uppercase tracking-wider mb-3">Retiros por pagar ({withdrawals.length})</h2>
            {withdrawals.length === 0 && (
              <div className="surface-card p-5 text-on-surface-variant" style={{ borderRadius: 0 }}>
                No hay retiros pendientes.
              </div>
            )}
            <div className="flex flex-col gap-3">
              {withdrawals.map((w) => (
                <article key={w.id} className="surface-card p-5 flex flex-col gap-3" style={{ borderRadius: 0 }}>
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                    <span className="font-headline-md text-headline-md text-on-surface figure-nums">{centsToPEN(w.amountCents)}</span>
                    <span className="text-on-surface">{w.userDisplayName}</span>
                    <span className="font-body-sm text-on-surface-variant">
                      {METHOD_LABEL[w.method]} → <span className="figure-nums text-on-surface">{w.destination}</span> · {w.holderName} · {new Date(w.createdAt).toLocaleString("es-PE")}
                    </span>
                  </div>
                  <Flags flags={w.riskFlags} />
                  <div className="flex gap-3">
                    <button type="button" disabled={busy === w.id} onClick={() => pay(w)} className="bg-primary text-on-primary px-5 py-2 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50">
                      Ya pagué
                    </button>
                    <button type="button" disabled={busy === w.id} onClick={() => reject("withdrawal", w.id)} className="text-error px-4 py-2 font-label-caps text-label-caps hover:bg-error/10 disabled:opacity-50">
                      Rechazar (devolver el saldo)
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
