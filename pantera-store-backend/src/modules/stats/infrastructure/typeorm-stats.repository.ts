import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface PlayerStatsRow {
  userId: string;
  displayName: string;
  matchesPlayed: number;
  wins: number;
  netCents: number;
}

/**
 * Estadísticas derivadas de `matches`/`settlements`, calculadas al vuelo con
 * SQL crudo (mismo patrón que las consultas de antifraude en `trust`) — no
 * hay una tabla propia de estadísticas, porque el resultado siempre se puede
 * reconstruir desde las partidas y liquidaciones ya guardadas.
 */
@Injectable()
export class TypeOrmStatsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Ranking de jugadores con al menos `minMatches` partidas terminadas (excluye anuladas/reembolsadas). */
  async leaderboard(minMatches: number, limit: number): Promise<PlayerStatsRow[]> {
    return this.query(
      `
      WITH teammates AS (
        SELECT m.id AS "matchId", m.outcome,
               (p->>'userId') AS "userId", (p->>'team') AS team, (p->>'displayName') AS "displayName"
          FROM matches m, jsonb_array_elements(m.participants) AS p
         WHERE m.status = 'finished'
      ),
      per_user AS (
        SELECT "userId", MAX("displayName") AS "displayName",
               COUNT(*)::int AS "matchesPlayed",
               SUM(CASE WHEN outcome = team THEN 1 ELSE 0 END)::int AS wins
          FROM teammates
         GROUP BY "userId"
      ),
      earnings AS (
        SELECT (p->>'userId') AS "userId",
               SUM((p->>'prizeCents')::int - (p->>'entryCents')::int)::int AS "netCents"
          FROM settlements s, jsonb_array_elements(s.payouts) AS p
         WHERE s."reversedAt" IS NULL
         GROUP BY (p->>'userId')
      )
      SELECT u."userId", u."displayName", u."matchesPlayed", u.wins,
             COALESCE(e."netCents", 0) AS "netCents"
        FROM per_user u
        LEFT JOIN earnings e ON e."userId" = u."userId"
       WHERE u."matchesPlayed" >= $1
       ORDER BY u.wins DESC, "netCents" DESC, u."matchesPlayed" DESC
       LIMIT $2
    `,
      [minMatches, limit],
    );
  }

  /** Las estadísticas de un único jugador (null si nunca terminó una partida). */
  async statsOf(userId: string): Promise<PlayerStatsRow | null> {
    const rows = await this.query(
      `
      WITH teammates AS (
        SELECT m.id AS "matchId", m.outcome,
               (p->>'userId') AS "userId", (p->>'team') AS team, (p->>'displayName') AS "displayName"
          FROM matches m, jsonb_array_elements(m.participants) AS p
         WHERE m.status = 'finished' AND (p->>'userId') = $1
      ),
      per_user AS (
        SELECT "userId", MAX("displayName") AS "displayName",
               COUNT(*)::int AS "matchesPlayed",
               SUM(CASE WHEN outcome = team THEN 1 ELSE 0 END)::int AS wins
          FROM teammates
         GROUP BY "userId"
      ),
      earnings AS (
        SELECT (p->>'userId') AS "userId",
               SUM((p->>'prizeCents')::int - (p->>'entryCents')::int)::int AS "netCents"
          FROM settlements s, jsonb_array_elements(s.payouts) AS p
         WHERE s."reversedAt" IS NULL AND (p->>'userId') = $1
         GROUP BY (p->>'userId')
      )
      SELECT u."userId", u."displayName", u."matchesPlayed", u.wins,
             COALESCE(e."netCents", 0) AS "netCents"
        FROM per_user u
        LEFT JOIN earnings e ON e."userId" = u."userId"
    `,
      [userId],
    );
    return rows[0] ?? null;
  }

  private async query(sql: string, params: unknown[]): Promise<PlayerStatsRow[]> {
    const rows = (await this.dataSource.manager.query(sql, params)) as {
      userId: string;
      displayName: string;
      matchesPlayed: string | number;
      wins: string | number;
      netCents: string | number;
    }[];
    return rows.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      matchesPlayed: Number(r.matchesPlayed),
      wins: Number(r.wins),
      netCents: Number(r.netCents),
    }));
  }
}
