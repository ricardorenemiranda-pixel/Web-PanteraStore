"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function PdfExportModal({ open, onClose }: Props) {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(plusDaysIso(7));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const params = new URLSearchParams({ validFrom: from, validTo: to });
      const res = await fetch(`/api/catalog-pdf?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudo generar el PDF.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catalogo-panterastore-${todayIso()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-panel p-6">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
          Vigencia de precios
        </h2>
        <p className="font-body-sm text-on-surface-variant mb-4">
          Ese rango se muestra en el pie del catálogo descargado.
        </p>

        {error && (
          <div className="mb-4 bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">
              Desde
            </label>
            <input
              type="date"
              className="bg-surface border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">
              Hasta
            </label>
            <input
              type="date"
              className="bg-surface border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 font-label-caps text-label-caps text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-primary text-on-primary px-4 py-2 font-label-caps text-label-caps hover:brightness-110 transition-all disabled:opacity-50"
          >
            {generating ? "Generando..." : "Descargar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
