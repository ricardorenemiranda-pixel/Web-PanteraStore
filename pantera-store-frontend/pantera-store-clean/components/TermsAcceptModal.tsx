"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { acceptTerms } from "@/lib/trustApi";

/**
 * Antes de jugar en salas hay que aceptar los Términos de Servicio vigentes.
 * Si se bumpea TERMS_VERSION en el backend, esto vuelve a pedirse aunque ya
 * se hubiera aceptado una versión anterior (ver User.hasAcceptedTerms).
 */
export default function TermsAcceptModal({ onConfirmed, onClose }: { onConfirmed: () => void; onClose: () => void }) {
  const { user, refresh } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const version = user?.termsVersion ?? 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await acceptTerms(version);
      await refresh();
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron aceptar los Términos.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Aceptar Términos de Servicio"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="surface-card w-full max-w-md p-6 flex flex-col gap-4"
        style={{ borderRadius: 0 }}
      >
        <h2 className="font-headline-md text-headline-md text-on-surface">Acepta los Términos de Servicio</h2>
        <p className="font-body-sm text-on-surface-variant">
          Para jugar en las salas necesitamos que aceptes los Términos de Servicio (versión {version}), incluyendo
          las reglas de conducta y cómo manejamos reportes, sanciones y disputas.
        </p>
        <Link href="/terminos" target="_blank" className="text-primary underline font-body-sm">
          Leer los Términos completos
        </Link>
        <label className="flex items-start gap-2 font-body-sm text-on-surface">
          <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          Leí y acepto los Términos de Servicio.
        </label>
        {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 font-label-caps text-label-caps text-on-surface-variant hover:text-on-surface"
          >
            Ahora no
          </button>
          <button
            type="submit"
            disabled={busy || !checked}
            className="bg-primary text-on-primary px-6 py-2.5 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Aceptando..." : "Aceptar y continuar"}
          </button>
        </div>
      </form>
    </div>
  );
}
