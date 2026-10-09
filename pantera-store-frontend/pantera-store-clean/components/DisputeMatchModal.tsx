"use client";

import { useState } from "react";
import { createDispute } from "@/lib/trustApi";

const inputClass = "bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3 w-full";

/**
 * Impugnar el resultado de una partida ya liquidada. Si el admin lo acepta,
 * se revierte TODO el pago (nadie gana, todos recuperan su entrada) — no se
 * redeclara un ganador distinto.
 */
export default function DisputeMatchModal({
  matchId,
  onClose,
  onDone,
}: {
  matchId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createDispute({ matchId, reason }, file);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la disputa.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Disputar resultado"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="surface-card w-full max-w-md p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
        style={{ borderRadius: 0 }}
      >
        <div className="flex justify-between items-start">
          <h2 className="font-headline-md text-headline-md text-on-surface">Disputar resultado</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-on-surface-variant hover:text-on-surface text-xl leading-none">
            ×
          </button>
        </div>
        <p className="font-body-sm text-on-surface-variant">
          Si un administrador acepta tu disputa, se anula la liquidación por completo: todos recuperan su entrada,
          nadie se queda con el premio y la plataforma devuelve su comisión.
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Motivo de la disputa</span>
          <textarea
            className={inputClass}
            rows={4}
            minLength={10}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explica qué pasó: por qué crees que el resultado no fue justo o válido."
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Evidencia (opcional, imagen máx. 2 MB)</span>
          <input className={inputClass} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}
        <button
          type="submit"
          disabled={busy || reason.trim().length < 10}
          className="bg-primary text-on-primary px-6 py-3 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Enviando..." : "Enviar disputa"}
        </button>
      </form>
    </div>
  );
}
