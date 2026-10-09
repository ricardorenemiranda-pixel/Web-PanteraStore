import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { PlayerStatsRow } from '../../../infrastructure/typeorm-stats.repository';

export class LeaderboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PlayerStatsResponseDto {
  userId!: string;
  displayName!: string;
  matchesPlayed!: number;
  wins!: number;
  losses!: number;
  winRatePercent!: number;
  netCents!: number;

  static fromRow(row: PlayerStatsRow): PlayerStatsResponseDto {
    const losses = row.matchesPlayed - row.wins;
    return {
      userId: row.userId,
      displayName: row.displayName,
      matchesPlayed: row.matchesPlayed,
      wins: row.wins,
      losses,
      winRatePercent: row.matchesPlayed > 0 ? Math.round((row.wins / row.matchesPlayed) * 1000) / 10 : 0,
      netCents: row.netCents,
    };
  }
}
