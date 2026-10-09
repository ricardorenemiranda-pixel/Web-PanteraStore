import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../auth/interface/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import type { RequestUser } from '../../../auth/interface/guards/jwt-auth.guard';
import { USER_REPOSITORY, type UserRepository } from '../../../auth/domain/ports/user.repository.port';
import { GetLeaderboardUseCase, GetMyStatsUseCase } from '../../application/get-player-stats.use-cases';
import { LeaderboardQueryDto, PlayerStatsResponseDto } from './dto/stats.dto';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(
    private readonly leaderboard: GetLeaderboardUseCase,
    private readonly myStats: GetMyStatsUseCase,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  /** Ranking de jugadores por victorias (y ganancia neta como desempate), solo con partidas terminadas de verdad. */
  @Get('leaderboard')
  async top(@Query() query: LeaderboardQueryDto) {
    const rows = await this.leaderboard.execute(query.limit);
    return rows.map(PlayerStatsResponseDto.fromRow);
  }

  /** Mis propias estadísticas (todo en cero si todavía no terminé ninguna partida). */
  @Get('me')
  async mine(@CurrentUser() user: RequestUser) {
    const row = await this.myStats.execute(user.userId);
    if (row) return PlayerStatsResponseDto.fromRow(row);
    const me = await this.users.findById(user.userId);
    return PlayerStatsResponseDto.fromRow({
      userId: user.userId,
      displayName: me?.displayName ?? '',
      matchesPlayed: 0,
      wins: 0,
      netCents: 0,
    });
  }
}
