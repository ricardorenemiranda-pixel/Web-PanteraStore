import { request } from "./adminApi";

export type MatchStatus = "waiting_players" | "in_game" | "finished" | "failed" | "voided";
export type MatchTeam = "radiant" | "dire";

export interface TeamPlayer {
  userId: string;
  displayName: string;
  present: boolean;
}

export interface MatchView {
  id: string;
  roomId: string;
  status: MatchStatus;
  provider: "manual" | "fake" | "steam";
  createdAt: string;
  lobbyName: string | null;
  lobbyPassword: string | null;
  yourTeam: MatchTeam | null;
  teams: Record<MatchTeam, TeamPlayer[]>;
  presentCount: number;
  total: number;
  joinDeadline: string | null;
  outcome: MatchTeam | null;
  resultSource: "bot" | "admin" | null;
  waitingForAdmin: boolean;
  failureReason: string | null;
  /** Lo que ganó o perdió este jugador (solo cuando la partida ya se pagó). */
  myResult: { won: boolean; entryCents: number; prizeCents: number; netCents: number } | null;
}

export interface AdminMatch {
  id: string;
  roomId: string;
  status: MatchStatus;
  provider: "manual" | "fake" | "steam";
  needsReview: boolean;
  outcome: MatchTeam | null;
  resultSource: "bot" | "admin" | null;
  dotaMatchId: string | null;
  failureReason: string | null;
  abandonedUserIds: string[];
  createdAt: string;
  finishedAt: string | null;
  settlement: {
    entryFeeCents: number;
    playerCount: number;
    prizePoolCents: number;
    prizeEachCents: number;
    platformCents: number;
  } | null;
  participants: { userId: string; steamId: string; displayName: string; team: MatchTeam }[];
}

export const TEAM_LABEL: Record<MatchTeam, string> = { radiant: "Radiant", dire: "Dire" };

export const FAILURE_LABEL: Record<string, string> = {
  players_no_show: "Faltaron jugadores en el lobby",
  lobby_lost: "Se perdió el lobby",
  room_changed: "La sala cambió antes de empezar",
};

export interface HistoryEntry {
  matchId: string;
  roomId: string;
  roomName: string;
  mode: string;
  at: string;
  result: "won" | "lost" | "refunded";
  yourTeam: MatchTeam;
  entryFeeCents: number;
  prizeCents: number;
  netCents: number;
  dotaMatchId: string | null;
  reason: string | null;
}

export function fetchMatchOfRoom(roomId: string): Promise<MatchView> {
  return request<MatchView>(`/rooms/${roomId}/match`);
}

export function fetchAdminMatches(): Promise<AdminMatch[]> {
  return request<AdminMatch[]>("/matches");
}

export function setMatchResult(matchId: string, outcome: MatchTeam): Promise<AdminMatch> {
  return request<AdminMatch>(`/matches/${matchId}/result`, {
    method: "POST",
    body: JSON.stringify({ outcome }),
  });
}

export function voidMatch(matchId: string, reason: string): Promise<AdminMatch> {
  return request<AdminMatch>(`/matches/${matchId}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function fetchMyHistory(): Promise<HistoryEntry[]> {
  return request<HistoryEntry[]>("/matches/me/history");
}
