import { request } from "./adminApi";

export interface PlayerStats {
  userId: string;
  displayName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRatePercent: number;
  netCents: number;
}

export function fetchLeaderboard(limit = 20): Promise<PlayerStats[]> {
  return request<PlayerStats[]>(`/stats/leaderboard?limit=${limit}`);
}

export function fetchMyStats(): Promise<PlayerStats> {
  return request<PlayerStats>("/stats/me");
}
