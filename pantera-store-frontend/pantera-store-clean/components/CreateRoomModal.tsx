"use client";

import { useState } from "react";
import { centsToPEN } from "@/lib/walletApi";
import {
  ROOM_CAPACITIES,
  ROOM_MODE_LABEL,
  type Room,
  type RoomMode,
  createRoom,
} from "@/lib/roomsApi";

interface Props {
  availableCents: number | null;
  onClose: () => void;
  onCreated: (room: Room) => void;
}

const inputClass =
  "bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3 w-full";

export default function CreateRoomModal({ availableCents, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<RoomMode>("captains_mode");
  const [capacity, setCapacity] = useState<number>(10);
  const [fee, setFee] = useState("11");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const feeCents = Math.round(Number(fee) * 100);
  const validFee = Number.isFinite(feeCents) && feeCents >= 100 && feeCents <= 50_000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError("Ponle un nombre a la sala (mínimo 3 letras).");
      return;
    }
    if (!validFee) {
      setError("La entrada debe estar entre S/ 1 y S/ 500.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      onCreated(await createRoom({ name: name.trim(), mode, capacity, entryFeeCents: feeCents }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sala.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crear sala"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="surface-card w-full max-w-md p-6 flex flex-col gap-4"
        style={{ borderRadius: 0 }}
      >
        <h2 className="font-headline-md text-headline-md text-on-surface">Crear sala</h2>

        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Nombre</span>
          <input
            className={inputClass}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Los fuertes sobreviven"
            autoFocus
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Modo</span>
            <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as RoomMode)}>
              {(Object.keys(ROOM_MODE_LABEL) as RoomMode[]).map((m) => (
                <option key={m} value={m}>
                  {ROOM_MODE_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Jugadores</span>
            <select className={inputClass} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
              {ROOM_CAPACITIES.map((c) => (
                <option key={c} value={c}>
                  {c} ({c / 2} vs {c / 2})
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Entrada por jugador (S/)</span>
          <input
            className={inputClass}
            type="number"
            min="1"
            max="500"
            step="0.5"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </label>

        {validFee && (
          <p className="font-body-sm text-on-surface-variant">
            Bolsa de entradas: <span className="text-on-surface figure-nums">{centsToPEN(feeCents * capacity)}</span>{" "}
            (a los ganadores, menos la comisión de la plataforma). Al crearla se bloquea tu entrada de{" "}
            <span className="text-on-surface figure-nums">{centsToPEN(feeCents)}</span>
            {availableCents !== null && (
              <>
                {" "}
                — tienes <span className="figure-nums">{centsToPEN(availableCents)}</span> disponibles
              </>
            )}
            .
          </p>
        )}

        {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 font-label-caps text-label-caps text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-on-primary px-6 py-2.5 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Creando..." : "Crear y entrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
