"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { BACKEND_URL } from "./config";
import { type ChatMessage, fetchChatHistory } from "./chatApi";

const MAX_KEPT = 200;

/**
 * Chat general: carga el historial por HTTP y después todo llega por
 * WebSocket. La conexión manda la cookie de sesión (withCredentials) porque
 * el gateway de chat, a diferencia del de salas, sí necesita saber quién sos.
 */
export function useChatLive(enabled: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchChatHistory()
      .then((history) => {
        if (!cancelled) setMessages(history);
      })
      .catch(() => undefined);

    const socket = io(`${BACKEND_URL}/chat`, { transports: ["websocket"], withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message].slice(-MAX_KEPT));
    });
    socket.on("chat:error", (message: string) => setError(message));
    socket.on("chat:online", (count: number) => setOnline(count));

    return () => {
      cancelled = true;
      socket.close();
      socketRef.current = null;
      setOnline(0);
    };
  }, [enabled]);

  const send = useCallback((body: string) => {
    setError("");
    socketRef.current?.emit("chat:send", body);
  }, []);

  return { messages, live, online, error, send, clearError: () => setError("") };
}
