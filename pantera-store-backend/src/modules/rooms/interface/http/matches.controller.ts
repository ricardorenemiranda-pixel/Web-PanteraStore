import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../auth/interface/decorators/current-user.decorator';
import { Roles } from '../../../auth/interface/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import type { RequestUser } from '../../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/interface/guards/roles.guard';
import { MatchOrchestrator } from '../../application/match-orchestrator';
import {
  ListMyMatchHistoryUseCase,
  VoidMatchUseCase,
} from '../../application/use-cases/settlement-use-cases';
import {
  SETTLEMENT_REPOSITORY,
  type SettlementRepository,
} from '../../domain/ports/settlement.repository.port';
import {
  HistoryEntryDto,
  MatchAdminViewDto,
  MatchPlayerViewDto,
  SetMatchResultDto,
  VoidMatchDto,
} from './dto/match.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatchesController {
  constructor(
    private readonly orchestrator: MatchOrchestrator,
    private readonly voidMatch: VoidMatchUseCase,
    private readonly history: ListMyMatchHistoryUseCase,
    @Inject(SETTLEMENT_REPOSITORY)
    private readonly settlements: SettlementRepository,
  ) {}

  /** La partida de mi sala: equipos, quién ya entró, la clave del lobby y, al terminar, lo que gané o perdí. */
  @Get('rooms/:id/match')
  async mine(@CurrentUser() user: RequestUser, @Param('id') roomId: string) {
    const { match, yourTeam } = await this.orchestrator.viewForPlayer(
      roomId,
      user,
    );
    const settlement = await this.settlements.findByMatchId(match.id);
    return MatchPlayerViewDto.fromDomain(
      match,
      yourTeam,
      settlement,
      user.userId,
    );
  }

  /** Mi historial de partidas cerradas: qué gané, qué perdí y cuáles me reembolsaron. */
  @Get('matches/me/history')
  async myHistory(@CurrentUser() user: RequestUser) {
    const entries = await this.history.execute(user.userId);
    return entries.map(HistoryEntryDto.fromEntry);
  }

  /** Panel de admin: todas las partidas y cómo se repartió el dinero en cada una. */
  @Get('matches')
  @Roles('admin')
  async list() {
    const matches = await this.orchestrator.listForAdmin();
    const settlements = await this.settlements.findByMatchIds(
      matches.map((m) => m.id),
    );
    const byMatch = new Map(settlements.map((s) => [s.matchId, s]));
    return matches.map((m) =>
      MatchAdminViewDto.fromDomain(m, byMatch.get(m.id)),
    );
  }

  /** Panel de admin: registrar el ganador. Se liquida solo: paga premios y cobra la comisión. */
  @Post('matches/:id/result')
  @HttpCode(200)
  @Roles('admin')
  async setResult(@Param('id') id: string, @Body() dto: SetMatchResultDto) {
    const match = await this.orchestrator.adminSetResult(id, dto.outcome);
    const settlement = await this.settlements.findByMatchId(id);
    return MatchAdminViewDto.fromDomain(match, settlement);
  }

  /** Panel de admin: anular una partida jugada (empate, inválida). Nadie gana y se reembolsa a todos. */
  @Post('matches/:id/void')
  @HttpCode(200)
  @Roles('admin')
  async voidOne(@Param('id') id: string, @Body() dto: VoidMatchDto) {
    return MatchAdminViewDto.fromDomain(
      await this.voidMatch.execute(id, dto.reason),
    );
  }
}
