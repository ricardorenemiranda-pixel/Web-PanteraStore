import { request } from "./adminApi";

export type RoomStatus = "waiting" | "full" | "playing" | "finished" | "cancelled";
export type RoomMode = "captains_mode" | "all_pick" | "turbo";
export type RoomView = "active" | "finished";

export interface RoomPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Room {
  id: string;
  name: string;
  game: "dota2";
  mode: RoomMode;
  capacity: number;
  playerCount: number;
  entryFeeCents: number;
  prizePoolCents: number;
  status: RoomStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  players: RoomPlayer[];
}

export const ROOM_MODE_LABEL: Record<RoomMode, string> = {
  captains_mode: "Captains Mode",
  all_pick: "All Pick",
  turbo: "Turbo",
};

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  waiting: "Esperando jugadores",
  full: "Lista para jugar",
  playing: "Jugando",
  finished: "Terminada",
  cancelled: "Cancelada",
};

export const ACTIVE_STATUSES: readonly RoomStatus[] = ["waiting", "full", "playing"];

export const ROOM_CAPACITIES = [2, 4, 6, 8, 10] as const;

export function fetchRooms(view: RoomView): Promise<Room[]> {
  return request<Room[]>(`/rooms?view=${view}`);
}

export function createRoom(input: {
  name: string;
  mode: RoomMode;
  capacity: number;
  entryFeeCents: number;
}): Promise<Room> {
  return request<Room>("/rooms", { method: "POST", body: JSON.stringify(input) });
}

export function joinRoom(id: string): Promise<Room> {
  return request<Room>(`/rooms/${id}/join`, { method: "POST" });
}

export function leaveRoom(id: string): Promise<Room> {
  return request<Room>(`/rooms/${id}/leave`, { method: "POST" });
}

export function cancelRoom(id: string): Promise<Room> {
  return request<Room>(`/rooms/${id}/cancel`, { method: "POST" });
}
