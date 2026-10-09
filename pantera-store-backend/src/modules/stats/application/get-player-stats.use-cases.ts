import { Injectable } from '@nestjs/common';
import { type PlayerStatsRow, TypeOrmStatsRepository } from '../infrastructure/typeorm-stats.repository';

const DEFAULT_LEADERBOARD_LIMIT = 20;
const MAX_LEADERBOARD_LIMIT = 100;

@Injectable()
export class GetLeaderboardUseCase {
  constructor(private readonly stats: TypeOrmStatsRepository) {}

  execute(limit?: number, minMatches = 1): Promise<PlayerStatsRow[]> {
    return this.stats.leaderboard(
      Math.max(minMatches, 1),
      Math.min(Math.max(limit ?? DEFAULT_LEADERBOARD_LIMIT, 1), MAX_LEADERBOARD_LIMIT),
    );
  }
}

@Injectable()
export class GetMyStatsUseCase {
  constructor(private readonly stats: TypeOrmStatsRepository) {}

  execute(userId: string): Promise<PlayerStatsRow | null> {
    return this.stats.statsOf(userId);
  }
}
