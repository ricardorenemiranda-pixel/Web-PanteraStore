"use client";

import { useEffect, useState } from "react";
import { centsToPEN, signedCentsToPEN } from "@/lib/walletApi";
import {
  FAILURE_LABEL,
  type MatchTeam,
  type MatchView,
  TEAM_LABEL,
  fetchMatchOfRoom,
} from "@/lib/matchesApi";

function useCountdown(deadline: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  const left = Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/** Tiempo transcurrido desde `since` (cuenta hacia arriba, para partidas en juego). */
function useElapsed(since: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);
  if (!since) return null;
  const elapsed = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function Team({ team, view }: { team: MatchTeam; view: MatchView }) {
  const mine = view.yourTeam === team;
  return (
    <div className={`p-4 border ${mine ? "border-primary" : "border-outline-variant"}`}>
      <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
        {TEAM_LABEL[team]}
        {mine && <span className="text-primary"> · tu equipo</span>}
      </p>
      <ul className="flex flex-col gap-1.5">
        {view.teams[team].map((p) => (
          <li key={p.userId} className="flex items-center gap-2 font-body-sm text-on-surface">
            {view.status === "waiting_players" && (
              <span
                className={`w-2 h-2 rounded-full ${p.present ? "bg-primary" : "bg-outline"}`}
                title={p.present ? "Ya está en el lobby" : "Todavía no entra"}
              />
            )}
            {p.displayName}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** La partida de mi sala: datos del lobby, equipos y estado. Se actualiza sola cada pocos segundos. */
export default function MatchModal({ roomId, roomName, onClose }: { roomId: string; roomName: string; onClose: () => void }) {
  const [view, setView] = useState<MatchView | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const countdown = useCountdown(view?.status === "waiting_players" ? view.joinDeadline : null);
  const elapsed = useElapsed(view?.status === "in_game" ? view.createdAt : null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchMatchOfRoom(roomId)
        .then((v) => {
          if (!cancelled) {
            setView(v);
            setError("");
          }
        })
        .catch(() => {
          // Justo al llenarse, la partida tarda un instante en aparecer.
          if (!cancelled) setError("Preparando la partida...");
        });
    void load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [roomId]);

  async function copyPassword() {
    if (!view?.lobbyPassword) return;
    try {
      await navigator.clipboard.writeText(view.lobbyPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sin portapapeles: la clave igual está a la vista */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Partida"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-card w-full max-w-xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: 0 }}
      >
        <div className="flex justify-between items-start gap-4">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">{roomName}</h2>
            <p className="font-body-sm text-on-surface-variant">Tu partida de Dota 2</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-on-surface-variant hover:text-on-surface text-xl leading-none">
            ×
          </button>
        </div>

        {!view && <p className="text-on-surface-variant">{error || "Cargando..."}</p>}

        {view && (
          <>
            {view.status === "waiting_players" && (
              <div className="bg-primary/10 border border-primary/20 p-4 flex flex-col gap-3">
                <p className="font-body-md text-on-surface">
                  Entra al lobby de Dota 2 y ponte en tu equipo. Entraron{" "}
                  <span className="figure-nums">
                    {view.presentCount}/{view.total}
                  </span>
                  {countdown && (
                    <>
                      {" "}
                      — quedan <span className="figure-nums">{countdown}</span>
                    </>
                  )}
                  . Si alguien no llega a tiempo, la sala se cancela y se devuelve la entrada a todos.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-label-caps text-[10px] uppercase text-on-surface-variant block">Nombre del lobby</span>
                    <span className="font-body-md text-on-surface">{view.lobbyName}</span>
                  </div>
                  <div>
                    <span className="font-label-caps text-[10px] uppercase text-on-surface-variant block">Clave</span>
                    <button
                      type="button"
                      onClick={copyPassword}
                      className="font-body-md text-primary figure-nums tracking-widest hover:underline"
                      title="Copiar clave"
                    >
                      {view.lobbyPassword} {copied && <span className="text-[11px] tracking-normal">¡copiada!</span>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view.status === "in_game" && (
              <div className="bg-primary/10 border border-primary/20 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                  <span className="font-label-caps text-[10px] uppercase text-error">En juego</span>
                  {elapsed && <span className="font-body-md text-on-surface figure-nums ml-auto">{elapsed}</span>}
                </div>
                <p className="font-body-md text-on-surface">
                  {view.provider === "manual"
                    ? "La partida está en juego. Organícense entre ustedes para jugarla; cuando termine, un administrador registrará el ganador."
                    : view.waitingForAdmin
                      ? "La partida terminó y un administrador está confirmando el resultado."
                      : "La partida está en juego. El resultado se registra solo al terminar."}
                </p>
                <p className="font-body-sm text-on-surface-variant">
                  No mostramos marcador en vivo: todavía no tenemos una conexión con la partida real de Dota 2 para
                  leer el estado del juego.
                </p>
              </div>
            )}

            {view.status === "finished" && (
              <div className="bg-primary/10 border border-primary/20 p-4 flex flex-col gap-2">
                <p className="font-headline-md text-headline-md text-on-surface">
                  Ganó {view.outcome ? TEAM_LABEL[view.outcome] : "—"}
                  {view.yourTeam && view.outcome && (
                    <span className={view.yourTeam === view.outcome ? " text-primary" : " text-error"}>
                      {view.yourTeam === view.outcome ? " · ¡ganaste!" : " · perdiste"}
                    </span>
                  )}
                </p>
                {view.myResult ? (
                  <p className="font-body-md text-on-surface-variant">
                    {view.myResult.won
                      ? `Se acreditó tu premio de ${centsToPEN(view.myResult.prizeCents)} (entrada ${centsToPEN(view.myResult.entryCents)}).`
                      : `Se cobró tu entrada de ${centsToPEN(view.myResult.entryCents)}.`}{" "}
                    Resultado neto:{" "}
                    <span className={view.myResult.netCents >= 0 ? "text-primary" : "text-error"}>
                      {signedCentsToPEN(view.myResult.netCents)}
                    </span>
                  </p>
                ) : (
                  <p className="font-body-sm text-on-surface-variant">Pagando premios...</p>
                )}
              </div>
            )}

            {view.status === "voided" && (
              <div className="bg-primary/10 border border-primary/20 p-4">
                <p className="font-body-md text-on-surface">
                  La partida se anuló ({view.failureReason ?? "sin motivo"}). Nadie gana y tu entrada fue devuelta.
                </p>
              </div>
            )}

            {view.status === "failed" && (
              <div className="bg-error/10 border border-error/20 p-4">
                <p className="font-body-md text-error">
                  La partida se canceló{view.failureReason ? `: ${FAILURE_LABEL[view.failureReason] ?? view.failureReason}` : ""}.
                  Tu entrada fue devuelta.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Team team="radiant" view={view} />
              <Team team="dire" view={view} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
