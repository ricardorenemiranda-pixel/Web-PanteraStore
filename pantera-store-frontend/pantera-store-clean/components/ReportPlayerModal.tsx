"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { fetchMatchOfRoom } from "@/lib/matchesApi";
import { REPORT_CATEGORIES, REPORT_CATEGORY_LABEL, type ReportCategory, createReport } from "@/lib/trustApi";

const inputClass = "bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3 w-full";

/** Reportar a otro jugador de una partida ya terminada, con evidencia opcional. */
export default function ReportPlayerModal({
  roomId,
  matchId,
  onClose,
  onDone,
}: {
  roomId: string;
  matchId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [players, setPlayers] = useState<{ userId: string; displayName: string }[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reportedUserId, setReportedUserId] = useState("");
  const [category, setCategory] = useState<ReportCategory>("toxic_chat");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMatchOfRoom(roomId)
      .then((view) => {
        const all = [...view.teams.radiant, ...view.teams.dire].filter((p) => p.userId !== user?.id);
        setPlayers(all);
        if (all.length === 1) setReportedUserId(all[0].userId);
      })
      .catch(() => setLoadError("No se pudo cargar la lista de jugadores de esta partida."));
  }, [roomId, user?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportedUserId) return setError("Elige a quién reportas.");
    setBusy(true);
    setError("");
    try {
      await createReport({ reportedUserId, roomId, matchId, category, description }, file);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el reporte.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reportar jugador"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="surface-card w-full max-w-md p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
        style={{ borderRadius: 0 }}
      >
        <div className="flex justify-between items-start">
          <h2 className="font-headline-md text-headline-md text-on-surface">Reportar jugador</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-on-surface-variant hover:text-on-surface text-xl leading-none">
            ×
          </button>
        </div>

        {loadError && <p className="text-error font-body-sm">{loadError}</p>}
        {!players && !loadError && <p className="text-on-surface-variant font-body-sm">Cargando jugadores...</p>}

        {players && players.length === 0 && (
          <p className="text-on-surface-variant font-body-sm">No hay otros jugadores en esta partida.</p>
        )}

        {players && players.length > 0 && (
          <>
            <label className="flex flex-col gap-1">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">A quién reportas</span>
              <select className={inputClass} value={reportedUserId} onChange={(e) => setReportedUserId(e.target.value)}>
                <option value="" disabled>
                  Elige un jugador
                </option>
                {players.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Motivo</span>
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {REPORT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Cuéntanos qué pasó</span>
              <textarea
                className={inputClass}
                rows={4}
                minLength={10}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sé específico: qué hizo, cuándo, en qué momento de la partida."
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Evidencia (opcional, imagen máx. 2 MB)</span>
              <input className={inputClass} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}
            <button
              type="submit"
              disabled={busy || !reportedUserId || description.trim().length < 10}
              className="bg-primary text-on-primary px-6 py-3 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Enviando..." : "Enviar reporte"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
