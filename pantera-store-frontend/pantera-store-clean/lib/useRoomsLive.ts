"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BACKEND_URL } from "./config";
import { ACTIVE_STATUSES, type Room, type RoomView, fetchRooms } from "./roomsApi";

function belongsTo(room: Room, view: RoomView): boolean {
  const active = ACTIVE_STATUSES.includes(room.status);
  return view === "active" ? active : !active;
}

/**
 * Lista de salas que se actualiza sola: carga inicial por HTTP y, después,
 * cada cambio llega por WebSocket (`room:updated`). Si la conexión se cae y
 * vuelve, se recarga la lista completa para no perder nada del intermedio.
 */
export function useRoomsLive(view: RoomView) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Carga por HTTP cada vez que cambia la pestaña (activas / terminadas).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchRooms(view)
      .then((list) => {
        if (!cancelled) setRooms(list);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar las salas. Intenta de nuevo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  // Una sola conexión mientras la página esté abierta.
  useEffect(() => {
    const socket = io(`${BACKEND_URL}/rooms`, { transports: ["websocket"] });
    let firstConnect = true;

    socket.on("connect", () => {
      setLive(true);
      if (!firstConnect) {
        fetchRooms(viewRef.current)
          .then(setRooms)
          .catch(() => {});
      }
      firstConnect = false;
    });
    socket.on("disconnect", () => setLive(false));

    socket.on("room:updated", (room: Room) => {
      setRooms((current) => {
        const rest = current.filter((r) => r.id !== room.id);
        if (!belongsTo(room, viewRef.current)) return rest;
        // Las salas nuevas van primero; las que ya estaban conservan su lugar.
        const index = current.findIndex((r) => r.id === room.id);
        if (index === -1) return [room, ...rest];
        const next = [...current];
        next[index] = room;
        return next;
      });
    });

    return () => {
      socket.close();
    };
  }, []);

  return { rooms, loading, error, live, setRooms };
}
