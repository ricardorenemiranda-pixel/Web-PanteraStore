"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import ReportPlayerModal from "@/components/ReportPlayerModal";
import DisputeMatchModal from "@/components/DisputeMatchModal";
import { useAuth } from "@/lib/AuthContext";
import { FAILURE_LABEL, type HistoryEntry, TEAM_LABEL, fetchMyHistory } from "@/lib/matchesApi";
import { ROOM_MODE_LABEL, type RoomMode } from "@/lib/roomsApi";
import { centsToPEN, signedCentsToPEN } from "@/lib/walletApi";

const RESULT: Record<HistoryEntry["result"], { label: string; className: string }> = {
  won: { label: "Ganaste", className: "text-primary border-primary/30 bg-primary/10" },
  lost: { label: "Perdiste", className: "text-error border-error/30 bg-error/10" },
  refunded: { label: "Reembolsada", className: "text-on-surface-variant border-outline-variant" },
};

export default function MisPartidasPage() {
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportTarget, setReportTarget] = useState<HistoryEntry | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<HistoryEntry | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchMyHistory()
      .then(setEntries)
      .catch(() => setError("No se pudo cargar tu historial."))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) return <div className="min-h-screen bg-background" />;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">Inicia sesión para ver tus partidas.</p>
          <Link href="/login" className="text-primary underline">
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  const wins = entries.filter((e) => e.result === "won").length;
  const played = entries.filter((e) => e.result !== "refunded").length;
  const net = entries.reduce((sum, e) => sum + e.netCents, 0);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow pt-24 pb-24 px-margin-mobile md:px-margin-desktop max-w-4xl mx-auto w-full">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Mis partidas</h1>
        <p className="text-on-surface-variant font-body-md mb-8">
          Cada sala que ya terminó: qué ganaste, qué perdiste y cuáles se reembolsaron.
        </p>

        {loading && <p className="text-on-surface-variant">Cargando...</p>}
        {error && <p className="text-error font-body-sm">{error}</p>}
        {notice && (
          <div className="mb-6 bg-primary/10 border border-primary/20 text-primary px-4 py-3 text-body-sm flex justify-between gap-4">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="surface-card p-8 text-center text-on-surface-variant" style={{ borderRadius: 0 }}>
            Todavía no terminaste ninguna partida.{" "}
            <Link href="/salas" className="text-primary underline">
              Ver salas
            </Link>
          </div>
        )}

        {entries.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="surface-card p-4" style={{ borderRadius: 0 }}>
                <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Jugadas</span>
                <p className="font-headline-md text-headline-md text-on-surface figure-nums">{played}</p>
              </div>
              <div className="surface-card p-4" style={{ borderRadius: 0 }}>
                <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Ganadas</span>
                <p className="font-headline-md text-headline-md text-on-surface figure-nums">{wins}</p>
              </div>
              <div className="surface-card p-4" style={{ borderRadius: 0 }}>
                <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Balance</span>
                <p className={`font-headline-md text-headline-md figure-nums ${net >= 0 ? "text-primary" : "text-error"}`}>
                  {signedCentsToPEN(net) === "—" ? centsToPEN(0) : signedCentsToPEN(net)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {entries.map((e) => (
                <article key={e.matchId} className="surface-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ borderRadius: 0 }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-3 py-1 border font-label-caps text-[10px] uppercase ${RESULT[e.result].className}`}>
                        {RESULT[e.result].label}
                      </span>
                      <h3 className="font-headline-md text-[18px] text-on-surface truncate">{e.roomName}</h3>
                    </div>
                    <p className="font-body-sm text-on-surface-variant">
                      {new Date(e.at).toLocaleString("es-PE")} · {ROOM_MODE_LABEL[e.mode as RoomMode] ?? e.mode} · {TEAM_LABEL[e.yourTeam]}
                      {e.result === "refunded" && e.reason ? ` · ${FAILURE_LABEL[e.reason] ?? e.reason}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <div>
                      <p className="font-body-sm text-on-surface-variant figure-nums">
                        Entrada {centsToPEN(e.entryFeeCents)}
                        {e.result === "won" && <> · premio {centsToPEN(e.prizeCents)}</>}
                      </p>
                      <p
                        className={`font-headline-md text-headline-md figure-nums ${
                          e.netCents > 0 ? "text-primary" : e.netCents < 0 ? "text-error" : "text-on-surface-variant"
                        }`}
                      >
                        {e.result === "refunded" ? "Devuelta" : signedCentsToPEN(e.netCents)}
                      </p>
                    </div>
                    {e.result !== "refunded" && (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setReportTarget(e)}
                          className="font-label-caps text-[10px] uppercase text-on-surface-variant hover:text-error"
                        >
                          Reportar jugador
                        </button>
                        <button
                          type="button"
                          onClick={() => setDisputeTarget(e)}
                          className="font-label-caps text-[10px] uppercase text-on-surface-variant hover:text-primary"
                        >
                          Disputar resultado
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>

      {reportTarget && (
        <ReportPlayerModal
          roomId={reportTarget.roomId}
          matchId={reportTarget.matchId}
          onClose={() => setReportTarget(null)}
          onDone={() => {
            setReportTarget(null);
            setNotice("Recibimos tu reporte. Un administrador lo va a revisar.");
          }}
        />
      )}

      {disputeTarget && (
        <DisputeMatchModal
          matchId={disputeTarget.matchId}
          onClose={() => setDisputeTarget(null)}
          onDone={() => {
            setDisputeTarget(null);
            setNotice("Recibimos tu disputa. Un administrador la va a revisar.");
          }}
        />
      )}

      <Footer />
      <BottomNav />
    </div>
  );
}
