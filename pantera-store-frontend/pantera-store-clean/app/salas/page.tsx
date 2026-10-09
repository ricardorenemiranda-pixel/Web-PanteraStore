"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import CreateRoomModal from "@/components/CreateRoomModal";
import AdultConfirmModal from "@/components/AdultConfirmModal";
import TermsAcceptModal from "@/components/TermsAcceptModal";
import MatchModal from "@/components/MatchModal";
import SalasSideNav from "@/components/SalasSideNav";
import SalasSidebar from "@/components/SalasSidebar";
import { useAuth } from "@/lib/AuthContext";
import {
  ACTIVE_STATUSES,
  ROOM_MODE_LABEL,
  ROOM_STATUS_LABEL,
  type Room,
  type RoomStatus,
  type RoomView,
  cancelRoom,
  joinRoom,
  leaveRoom,
} from "@/lib/roomsApi";
import { useRoomsLive } from "@/lib/useRoomsLive";
import { centsToPEN, fetchMyWallet } from "@/lib/walletApi";

const STATUS_DOT: Record<RoomStatus, string> = {
  waiting: "bg-primary",
  full: "bg-rarity-immortal",
  playing: "bg-error",
  finished: "bg-on-surface-variant",
  cancelled: "bg-on-surface-variant",
};

const STATUS_PILL: Record<RoomStatus, string> = {
  waiting: "text-primary border-primary/30 bg-primary/10",
  full: "text-rarity-immortal border-rarity-immortal/30 bg-rarity-immortal/10",
  playing: "text-error border-error/30 bg-error/10",
  finished: "text-on-surface-variant border-outline-variant",
  cancelled: "text-on-surface-variant border-outline-variant",
};

function Slots({ room }: { room: Room }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: room.capacity }, (_, i) => {
        const player = room.players[i];
        return player ? (
          <div
            key={player.userId}
            title={player.displayName}
            className="w-9 h-9 bg-surface-container-highest border border-outline-variant overflow-hidden flex items-center justify-center"
          >
            {player.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.avatarUrl} alt={player.displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="font-label-caps text-[11px] text-on-surface">
                {player.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        ) : (
          <div key={`empty-${i}`} className="w-9 h-9 border border-dashed border-outline-variant" />
        );
      })}
    </div>
  );
}

function RoomCard({
  room,
  userId,
  isAdmin,
  busy,
  onJoin,
  onLeave,
  onCancel,
  onLogin,
  onOpenMatch,
}: {
  room: Room;
  userId: string | null;
  isAdmin: boolean;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onCancel: () => void;
  onLogin: () => void;
  onOpenMatch: () => void;
}) {
  const isMember = userId !== null && room.players.some((p) => p.userId === userId);
  const isCreator = userId !== null && room.createdBy === userId;
  const open = room.status === "waiting" || room.status === "full";
  const dead = !ACTIVE_STATUSES.includes(room.status);

  return (
    <article className={`surface-card p-5 md:p-6 flex flex-col gap-5 ${dead ? "opacity-70" : ""}`} style={{ borderRadius: 0 }}>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="font-headline-md text-headline-md text-on-surface truncate">{room.name}</h3>
            <span className={`px-2.5 py-0.5 border font-label-caps text-[10px] uppercase flex items-center gap-1.5 ${STATUS_PILL[room.status]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[room.status]}`} />
              {ROOM_STATUS_LABEL[room.status]}
            </span>
          </div>
          <p className="font-body-sm text-on-surface-variant">
            Creada por <span className="text-on-surface">{room.createdByName}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-body-md text-on-surface-variant figure-nums">
            {room.playerCount}/{room.capacity}
          </span>
          {open && !isMember && (
            <button
              type="button"
              disabled={busy || room.status === "full"}
              onClick={userId ? onJoin : onLogin}
              className="bg-primary text-on-primary px-6 py-2.5 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {room.status === "full" ? "Llena" : userId ? "Entrar" : "Inicia sesión"}
            </button>
          )}
          {isMember && (room.status === "full" || room.status === "playing") && (
            <button
              type="button"
              onClick={onOpenMatch}
              className="bg-primary text-on-primary px-6 py-2.5 font-label-caps text-label-caps hover:brightness-110"
            >
              Ver partida
            </button>
          )}
          {open && isMember && !isCreator && (
            <button
              type="button"
              disabled={busy}
              onClick={onLeave}
              className="border border-outline text-on-surface px-6 py-2.5 font-label-caps text-label-caps hover:bg-on-surface/5 disabled:opacity-50"
            >
              Salir
            </button>
          )}
          {open && (isCreator || isAdmin) && (
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="text-error px-3 py-2.5 font-label-caps text-label-caps hover:bg-error/10 disabled:opacity-50"
            >
              Cancelar sala
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <dt className="font-label-caps text-[10px] uppercase text-on-surface-variant">Entrada</dt>
            <dd className="font-body-md text-on-surface figure-nums">{centsToPEN(room.entryFeeCents)}</dd>
          </div>
          <div>
            <dt className="font-label-caps text-[10px] uppercase text-on-surface-variant">Premio</dt>
            <dd className="font-body-md text-primary figure-nums">{centsToPEN(room.prizePoolCents)}</dd>
          </div>
          <div>
            <dt className="font-label-caps text-[10px] uppercase text-on-surface-variant">Modo de juego</dt>
            <dd className="font-body-md text-on-surface">{ROOM_MODE_LABEL[room.mode]}</dd>
          </div>
        </dl>
        <Slots room={room} />
      </div>
    </article>
  );
}

export default function SalasPage() {
  const { user } = useAuth();
  const [view, setView] = useState<RoomView>("active");
  const { rooms, loading, error, live } = useRoomsLive(view);
  const [creating, setCreating] = useState(false);
  const [ageGate, setAgeGate] = useState<null | (() => void)>(null);
  const [termsGate, setTermsGate] = useState<null | (() => void)>(null);
  const [matchRoom, setMatchRoom] = useState<Room | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [available, setAvailable] = useState<number | null>(null);

  const refreshBalance = () => {
    if (!user) {
      setAvailable(null);
      return;
    }
    fetchMyWallet(1)
      .then((v) => setAvailable(v.wallet.availableCents))
      .catch(() => setAvailable(null));
  };

  useEffect(refreshBalance, [user]);

  /** Jugar con dinero exige haber confirmado ser mayor de 18: si falta, se pide antes de seguir. */
  function withAdultCheck(proceed: () => void) {
    if (user && !user.adultConfirmed) setAgeGate(() => proceed);
    else proceed();
  }

  /** También exige haber aceptado la versión vigente de los Términos de Servicio. */
  function withTermsCheck(proceed: () => void) {
    if (user && user.termsAccepted === false) setTermsGate(() => proceed);
    else proceed();
  }

  /** Crear/unirse a una sala exige ambos gates: primero edad, luego términos. */
  function withPlayGates(proceed: () => void) {
    withAdultCheck(() => withTermsCheck(proceed));
  }

  async function run(roomId: string, action: (id: string) => Promise<Room>) {
    setBusyId(roomId);
    setActionError("");
    try {
      await action(roomId);
      // La sala se actualiza sola por WebSocket; acá solo se refresca el saldo.
      refreshBalance();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusyId(null);
    }
  }

  const goLogin = () => {
    window.location.href = "/login";
  };

  // Estadísticas de lo que se está viendo ahora mismo (activas o terminadas, según la pestaña).
  const stats = useMemo(
    () => ({
      roomCount: rooms.length,
      playerCount: rooms.reduce((sum, r) => sum + r.playerCount, 0),
      prizePoolCents: rooms.reduce((sum, r) => sum + r.prizePoolCents, 0),
    }),
    [rooms],
  );

  return (
    <>
      <Header />
      <main className="pt-24 pb-24 lg:pb-10 min-h-screen px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
      <div className="flex items-start gap-6">
        <SalasSideNav />
        <div className="flex-1 min-w-0">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-headline-xl text-headline-lg-mobile md:text-headline-xl text-on-surface">Salas</h1>
            <p className="font-body-md text-on-surface-variant mt-2">
              Juega Dota 2 con la comunidad. Tu entrada se bloquea al entrar y se te devuelve si la sala se cancela o sales
              antes de empezar.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {user && available !== null && (
              <Link
                href="/billetera"
                className="surface-card px-4 py-2.5 flex flex-col leading-tight"
                style={{ borderRadius: 0 }}
              >
                <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Mi saldo</span>
                <span className="font-body-md text-on-surface figure-nums">{centsToPEN(available)}</span>
              </Link>
            )}
            <button
              type="button"
              onClick={user ? () => withPlayGates(() => setCreating(true)) : goLogin}
              className="bg-primary text-on-primary px-6 py-3 font-label-caps text-label-caps hover:brightness-110"
            >
              {user ? "Crear sala" : "Inicia sesión para jugar"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="surface-card p-4" style={{ borderRadius: 0 }}>
            <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">
              {view === "active" ? "Salas activas" : "Salas terminadas"}
            </span>
            <p className="font-headline-md text-headline-md text-on-surface figure-nums">{stats.roomCount}</p>
          </div>
          <div className="surface-card p-4" style={{ borderRadius: 0 }}>
            <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Jugadores</span>
            <p className="font-headline-md text-headline-md text-on-surface figure-nums">{stats.playerCount}</p>
          </div>
          <div className="surface-card p-4" style={{ borderRadius: 0 }}>
            <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">
              {view === "active" ? "Premio en juego" : "Premio repartido"}
            </span>
            <p className="font-headline-md text-headline-md text-primary figure-nums">{centsToPEN(stats.prizePoolCents)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex gap-2">
            {(
              [
                ["active", "Activas"],
                ["finished", "Terminadas"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`px-5 py-2 font-label-caps text-label-caps border transition-colors ${
                  view === id
                    ? "bg-primary text-on-primary border-primary"
                    : "border-outline-variant text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 font-label-caps text-[10px] uppercase text-on-surface-variant">
            <span className="border border-outline-variant px-3 py-1.5 text-on-surface">Dota 2</span>
            <span className="flex items-center gap-2" title={live ? "Actualización en vivo" : "Sin conexión en vivo"}>
              <span className={`w-2 h-2 rounded-full ${live ? "bg-primary" : "bg-outline"}`} />
              {live ? "En vivo" : "Reconectando..."}
            </span>
          </div>
        </div>

        {actionError && (
          <div className="mb-6 bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm flex justify-between gap-4">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError("")} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}

        {loading && <p className="text-on-surface-variant">Cargando salas...</p>}
        {error && <p className="text-error font-body-sm">{error}</p>}

        {!loading && !error && rooms.length === 0 && (
          <div className="surface-card flex flex-col items-center justify-center gap-4 py-20 px-10 text-center" style={{ borderRadius: 0 }}>
            <span className="material-symbols-outlined text-5xl text-on-surface-variant">
              {view === "active" ? "sports_esports" : "history"}
            </span>
            <div>
              <p className="font-headline-md text-headline-md text-on-surface mb-1">
                {view === "active" ? "Todavía no hay salas activas" : "Todavía no hay salas terminadas"}
              </p>
              <p className="font-body-md text-on-surface-variant">
                {view === "active" ? "Sé el primero en crear una y esperar rivales." : "Cuando termine una partida, aparece acá."}
              </p>
            </div>
            {view === "active" && (
              <button
                type="button"
                onClick={user ? () => withPlayGates(() => setCreating(true)) : goLogin}
                className="bg-primary text-on-primary px-6 py-3 font-label-caps text-label-caps hover:brightness-110"
              >
                {user ? "Crear sala" : "Inicia sesión para jugar"}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              userId={user?.id ?? null}
              isAdmin={user?.role === "admin"}
              busy={busyId === room.id}
              onJoin={() => withPlayGates(() => run(room.id, joinRoom))}
              onLeave={() => run(room.id, leaveRoom)}
              onCancel={() => run(room.id, cancelRoom)}
              onLogin={goLogin}
              onOpenMatch={() => setMatchRoom(room)}
            />
          ))}
        </div>
        </div>
        <SalasSidebar />
      </div>
      </main>

      {creating && (
        <CreateRoomModal
          availableCents={available}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refreshBalance();
          }}
        />
      )}

      {ageGate && (
        <AdultConfirmModal
          onClose={() => setAgeGate(null)}
          onConfirmed={() => {
            const proceed = ageGate;
            setAgeGate(null);
            proceed();
          }}
        />
      )}

      {termsGate && (
        <TermsAcceptModal
          onClose={() => setTermsGate(null)}
          onConfirmed={() => {
            const proceed = termsGate;
            setTermsGate(null);
            proceed();
          }}
        />
      )}

      {matchRoom && (
        <MatchModal roomId={matchRoom.id} roomName={matchRoom.name} onClose={() => setMatchRoom(null)} />
      )}

      <Footer />
      <BottomNav />
    </>
  );
}
