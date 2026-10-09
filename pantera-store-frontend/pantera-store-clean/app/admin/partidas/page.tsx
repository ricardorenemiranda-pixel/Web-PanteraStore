"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import {
  type AdminMatch,
  FAILURE_LABEL,
  type MatchStatus,
  type MatchTeam,
  TEAM_LABEL,
  fetchAdminMatches,
  setMatchResult,
  voidMatch,
} from "@/lib/matchesApi";
import { centsToPEN } from "@/lib/walletApi";

const STATUS_LABEL: Record<MatchStatus, string> = {
  waiting_players: "Esperando jugadores",
  in_game: "En juego",
  finished: "Terminada",
  failed: "Fallida",
  voided: "Anulada",
};

export default function AdminMatchesPage() {
  const { user, loading: userLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetchAdminMatches()
      .then((list) => {
        setMatches(list);
        setError("");
      })
      .catch(() => setError("No se pudieron cargar las partidas."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [isAdmin, load]);

  if (userLoading) return <div className="min-h-screen bg-background" />;

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">
            {user ? "Tu cuenta no tiene permisos de administrador." : "Inicia sesión para continuar."}
          </p>
          <Link href={user ? "/" : "/login"} className="text-primary underline">
            {user ? "Volver al inicio" : "Iniciar sesión"}
          </Link>
        </div>
      </div>
    );
  }

  async function decide(match: AdminMatch, outcome: MatchTeam) {
    const names = match.participants
      .filter((p) => p.team === outcome)
      .map((p) => p.displayName)
      .join(", ");
    if (!window.confirm(`¿Confirmas que ganó ${TEAM_LABEL[outcome]} (${names})? No se puede cambiar después.`)) return;
    setBusy(match.id);
    setError("");
    try {
      await setMatchResult(match.id, outcome);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el resultado.");
    } finally {
      setBusy(null);
    }
  }

  async function annul(match: AdminMatch) {
    const reason = window.prompt("Motivo de la anulación (empate, partida inválida...). Se devolverá la entrada a todos los jugadores:");
    if (!reason || reason.trim().length < 3) return;
    setBusy(match.id);
    setError("");
    try {
      await voidMatch(match.id, reason.trim());
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo anular la partida.");
    } finally {
      setBusy(null);
    }
  }

  // Primero lo que necesita una decisión, luego lo activo, luego el historial.
  const rank = (m: AdminMatch) => (m.status === "in_game" && (m.provider === "manual" || m.needsReview) ? 0 : m.status === "waiting_players" || m.status === "in_game" ? 1 : 2);
  const sorted = [...matches].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md">
      <header className="fixed top-0 left-0 w-full z-50 flex items-center gap-4 px-margin-mobile md:px-margin-desktop h-16 bg-surface/80 backdrop-blur-xl border-b border-on-surface/10">
        <Link href="/admin" className="flex items-center gap-1 font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver al panel
        </Link>
      </header>

      <main className="pt-16">
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-12">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Partidas</h1>
          <p className="text-on-surface-variant mb-8">
            Registra el ganador de las partidas que lo necesitan: las del modo manual y las que el bot no pudo confirmar.
            El pago de premios se hace a partir de este resultado.
          </p>

          {error && <div className="mb-6 bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}
          {loading && <p className="text-on-surface-variant">Cargando...</p>}
          {!loading && sorted.length === 0 && (
            <div className="surface-card p-8 text-center text-on-surface-variant" style={{ borderRadius: 0 }}>
              Todavía no hay partidas.
            </div>
          )}

          <div className="flex flex-col gap-4">
            {sorted.map((m) => {
              const needsDecision = m.status === "in_game" && (m.provider === "manual" || m.needsReview);
              return (
                <article key={m.id} className="surface-card p-5 flex flex-col gap-4" style={{ borderRadius: 0 }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-body-md text-on-surface">
                        Sala <span className="figure-nums text-on-surface-variant">{m.roomId.slice(0, 8)}</span>
                      </p>
                      <p className="font-body-sm text-on-surface-variant">
                        {new Date(m.createdAt).toLocaleString("es-PE")} · {m.provider === "manual" ? "modo manual" : `bot ${m.provider}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 font-label-caps text-[10px] uppercase">
                      {needsDecision && (
                        <span className="bg-error/10 border border-error/20 text-error px-3 py-1">
                          {m.needsReview ? "Revisar resultado" : "Falta el ganador"}
                        </span>
                      )}
                      <span className="border border-outline-variant text-on-surface px-3 py-1">{STATUS_LABEL[m.status]}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(["radiant", "dire"] as const).map((team) => (
                      <div key={team} className={`p-3 border ${m.outcome === team ? "border-primary bg-primary/5" : "border-outline-variant"}`}>
                        <p className="font-label-caps text-[10px] uppercase text-on-surface-variant mb-1">
                          {TEAM_LABEL[team]}
                          {m.outcome === team && <span className="text-primary"> · ganó</span>}
                        </p>
                        <ul className="font-body-sm text-on-surface">
                          {m.participants
                            .filter((p) => p.team === team)
                            .map((p) => (
                              <li key={p.userId}>
                                {p.displayName}
                                {m.abandonedUserIds.includes(p.userId) && <span className="text-error"> · abandonó</span>}
                              </li>
                            ))}
                        </ul>
                        {needsDecision && (
                          <button
                            type="button"
                            disabled={busy === m.id}
                            onClick={() => decide(m, team)}
                            className="mt-3 bg-primary text-on-primary px-4 py-2 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50"
                          >
                            Ganó {TEAM_LABEL[team]}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {m.status === "in_game" && (
                    <div>
                      <button
                        type="button"
                        disabled={busy === m.id}
                        onClick={() => annul(m)}
                        className="text-error px-3 py-2 font-label-caps text-label-caps hover:bg-error/10 disabled:opacity-50"
                      >
                        Anular partida (empate / inválida)
                      </button>
                    </div>
                  )}

                  {m.status === "voided" && (
                    <p className="font-body-sm text-on-surface-variant">
                      Anulada{m.failureReason ? `: ${m.failureReason}` : ""} — se devolvió la entrada a todos.
                    </p>
                  )}

                  {m.status === "failed" && (
                    <p className="font-body-sm text-error">
                      {m.failureReason ? (FAILURE_LABEL[m.failureReason] ?? m.failureReason) : "Falló"} — se devolvió la entrada a los jugadores.
                    </p>
                  )}
                  {m.status === "finished" && (
                    <div className="font-body-sm text-on-surface-variant flex flex-col gap-1">
                      <p>
                        Resultado registrado por {m.resultSource === "admin" ? "un administrador" : "el bot"}
                        {m.dotaMatchId ? ` · partida de Dota ${m.dotaMatchId}` : ""}.
                      </p>
                      {m.settlement ? (
                        <p className="figure-nums">
                          Entradas {centsToPEN(m.settlement.entryFeeCents * m.settlement.playerCount)} → premio de{" "}
                          <span className="text-primary">{centsToPEN(m.settlement.prizeEachCents)}</span> a cada ganador
                          · comisión de la plataforma{" "}
                          <span className="text-on-surface">{centsToPEN(m.settlement.platformCents)}</span>
                        </p>
                      ) : (
                        <p className="text-error">Pendiente de pago: se liquida sola en unos segundos.</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
