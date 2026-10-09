import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GetLeaderboardUseCase, GetMyStatsUseCase } from './application/get-player-stats.use-cases';
import { TypeOrmStatsRepository } from './infrastructure/typeorm-stats.repository';
import { StatsController } from './interface/http/stats.controller';

@Module({
  imports: [AuthModule],
  controllers: [StatsController],
  providers: [TypeOrmStatsRepository, GetLeaderboardUseCase, GetMyStatsUseCase],
})
export class StatsModule {}
