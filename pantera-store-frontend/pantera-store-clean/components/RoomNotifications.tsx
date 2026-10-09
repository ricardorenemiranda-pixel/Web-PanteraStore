"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/lib/AuthContext";
import { BACKEND_URL } from "@/lib/config";
import type { Room, RoomStatus } from "@/lib/roomsApi";

interface Toast {
  id: string;
  text: string;
}

const NOTIFY_ON: Partial<Record<RoomStatus, string>> = {
  full: "¡Tu sala se llenó! Se va a abrir la partida.",
  playing: "Tu partida está lista. ¡Entra al lobby!",
};

/**
 * Avisos de "sala llena" / "partida lista", derivados del mismo stream
 * público de room:updated que ya usa la lista de salas (sin backend nuevo):
 * se comparan los cambios de estado de las salas donde participa este
 * usuario y, si corresponde, se muestra un aviso (y una notificación del
 * navegador, si el usuario la permitió).
 */
export default function RoomNotifications() {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const knownStatus = useRef(new Map<string, RoomStatus>());

  useEffect(() => {
    if (!user) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }

    const socket = io(`${BACKEND_URL}/rooms`, { transports: ["websocket"] });
    socket.on("room:updated", (room: Room) => {
      const mine = room.players.some((p) => p.userId === user.id);
      const previous = knownStatus.current.get(room.id);
      knownStatus.current.set(room.id, room.status);
      if (!mine || !previous || previous === room.status) return;

      const text = NOTIFY_ON[room.status];
      if (!text) return;
      const message = `${text} (${room.name})`;
      setToasts((t) => [...t, { id: `${room.id}-${room.status}-${Date.now()}`, text: message }]);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("PanteraStore", { body: message });
      }
    });

    return () => {
      socket.close();
    };
  }, [user]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const id = setTimeout(() => setToasts((t) => t.slice(1)), 6000);
    return () => clearTimeout(id);
  }, [toasts]);

  if (!user || toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="surface-card px-4 py-3 border-l-4 border-l-primary font-body-sm text-on-surface shadow-lg"
          style={{ borderRadius: 0 }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
