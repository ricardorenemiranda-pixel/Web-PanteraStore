"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { confirmAdult } from "@/lib/paymentsApi";

/**
 * Antes de jugar con dinero, recargar o retirar hay que declarar que se es
 * mayor de 18. Es una declaración (no verifica identidad): sirve de primer
 * filtro y deja constancia de la fecha de nacimiento declarada.
 */
export default function AdultConfirmModal({ onConfirmed, onClose }: { onConfirmed: () => void; onClose: () => void }) {
  const { refresh } = useAuth();
  const [birthDate, setBirthDate] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!birthDate) {
      setError("Ingresa tu fecha de nacimiento.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await confirmAdult(birthDate);
      await refresh();
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar tu edad.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar mayoría de edad"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="surface-card w-full max-w-md p-6 flex flex-col gap-4"
        style={{ borderRadius: 0 }}
      >
        <h2 className="font-headline-md text-headline-md text-on-surface">Confirma que eres mayor de 18</h2>
        <p className="font-body-sm text-on-surface-variant">
          Para jugar en las salas con dinero, recargar o retirar necesitamos que declares tu fecha de nacimiento. Solo
          pueden participar mayores de 18 años.
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Fecha de nacimiento</span>
          <input
            type="date"
            className="bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
            value={birthDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </label>
        <label className="flex items-start gap-2 font-body-sm text-on-surface">
          <input type="checkbox" className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          Declaro que los datos son verdaderos y que soy mayor de 18 años.
        </label>
        {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2.5 font-label-caps text-label-caps text-on-surface-variant hover:text-on-surface">
            Ahora no
          </button>
          <button
            type="submit"
            disabled={busy || !accepted || !birthDate}
            className="bg-primary text-on-primary px-6 py-2.5 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Confirmando..." : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}
