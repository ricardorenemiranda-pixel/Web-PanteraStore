import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from '../../../../shared/application/unit-of-work';
import { ACTIVITY_FEED, type ActivityFeed } from '../../../../shared/activity/domain/activity-feed.port';
import {
  EntityNotFoundException,
  InvalidDomainStateException,
} from '../../../../shared/domain/exceptions/domain.exception';
import {
  ChargeStakeUseCase,
  CollectPlatformFeeUseCase,
  PayPrizeUseCase,
  ReleaseStakeUseCase,
} from '../../../wallet/application/use-cases/stake-operations.use-cases';
import type { Match } from '../../domain/entities/match.entity';
import type { Room } from '../../domain/entities/room.entity';
import {
  computeSettlement,
  Settlement,
  type SettlementPayout,
} from '../../domain/entities/settlement.entity';
import {
  MATCH_REPOSITORY,
  type MatchRepository,
} from '../../domain/ports/match.repository.port';
import {
  ROOM_EVENTS,
  type RoomEvents,
} from '../../domain/ports/room-events.port';
import {
  ROOM_REPOSITORY,
  type RoomRepository,
} from '../../domain/ports/room.repository.port';
import {
  SETTLEMENT_REPOSITORY,
  type SettlementRepository,
} from '../../domain/ports/settlement.repository.port';

/**
 * Convierte el resultado de una partida en dinero, TODO en una transacción:
 *   1. cobra la entrada de cada jugador (sale de "bloqueado"),
 *   2. paga el premio a cada ganador,
 *   3. la plataforma recibe la comisión (más el sobrante de dividir la bolsa),
 *   4. la sala pasa a "terminada" y queda el registro de la liquidación.
 * Es idempotente: liquidar dos veces (o a la vez) paga UNA sola vez.
 */
@Injectable()
export class SettleMatchUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(MATCH_REPOSITORY) private readonly matches: MatchRepository,
    @Inject(SETTLEMENT_REPOSITORY)
    private readonly settlements: SettlementRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(ROOM_EVENTS) private readonly events: RoomEvents,
    @Inject(ACTIVITY_FEED) private readonly feed: ActivityFeed,
    private readonly chargeStake: ChargeStakeUseCase,
    private readonly payPrize: PayPrizeUseCase,
    private readonly collectFee: CollectPlatformFeeUseCase,
  ) {}

  async execute(matchId: string): Promise<Settlement> {
    const known = await this.matches.findById(matchId);
    if (!known) throw new EntityNotFoundException('Partida', matchId);

    const { settlement, room, created } = await this.uow.run(async (tx) => {
      // La sala se bloquea primero: cualquier otra liquidación (o salida, o cancelación) espera acá.
      const room = await this.rooms.findByIdForUpdate(known.roomId, tx);
      if (!room) throw new EntityNotFoundException('Sala', known.roomId);

      const existing = await this.settlements.findByMatchId(matchId, tx);
      if (existing) return { settlement: existing, room, created: false };

      const match = await this.matches.findById(matchId, tx);
      if (!match || match.status !== 'finished' || !match.outcome) {
        throw new InvalidDomainStateException(
          'La partida todavía no tiene un resultado para liquidar.',
        );
      }

      const settlement = await this.pay(room, match, tx);
      room.finish();
      await this.rooms.save(room, tx);
      await this.settlements.save(settlement, tx);
      return { settlement, room, created: true };
    });

    if (created) {
      this.events.roomChanged(room);
      await this.announcePrize(room, settlement);
    }
    return settlement;
  }

  /** Un ganador (o varios, si hay empate de equipo) se anuncia en el feed público. */
  private async announcePrize(room: Room, settlement: Settlement): Promise<void> {
    const winners = settlement.payouts.filter((p) => p.won && p.prizeCents > 0);
    if (winners.length === 0) return;
    const names = winners.map((w) => w.displayName).join(', ');
    const prize = (winners[0].prizeCents / 100).toFixed(2);
    await this.feed.record({
      kind: 'prize',
      message: `${names} ${winners.length > 1 ? 'ganaron' : 'ganó'} S/ ${prize} en "${room.name}".`,
      targetType: 'room',
      targetId: room.id,
    });
  }

  private async pay(
    room: Room,
    match: Match,
    tx: Parameters<SettlementRepository['save']>[1],
  ): Promise<Settlement> {
    const players = room.players;
    if (
      players.length !== match.participants.length ||
      !match.participants.every((p) => room.hasPlayer(p.userId))
    ) {
      throw new InvalidDomainStateException(
        'Los jugadores de la sala no coinciden con los de la partida.',
      );
    }

    const winnerIds = new Set(match.winners.map((p) => p.userId));
    const amounts = computeSettlement({
      entryFeeCents: room.entryFeeCents,
      playerCount: players.length,
      prizePoolCents: room.prizePoolCents,
      winnerCount: winnerIds.size,
    });

    const payouts: SettlementPayout[] = [];
    // Siempre en el mismo orden (por usuario, y la plataforma al final): evita bloqueos cruzados.
    for (const player of [...players].sort((a, b) =>
      a.userId.localeCompare(b.userId),
    )) {
      const participant = match.participantOf(player.userId)!;
      const ref = {
        userId: player.userId,
        amountCents: room.entryFeeCents,
        referenceType: 'room',
        referenceId: room.id,
        attempt: player.joinId,
      };
      await this.chargeStake.execute(ref, tx);

      const won = winnerIds.has(player.userId);
      if (won && amounts.prizeEachCents > 0) {
        await this.payPrize.execute(
          { ...ref, amountCents: amounts.prizeEachCents },
          tx,
        );
      }
      payouts.push({
        userId: player.userId,
        displayName: participant.displayName,
        team: participant.team,
        won,
        entryCents: room.entryFeeCents,
        prizeCents: won ? amounts.prizeEachCents : 0,
      });
    }
    await this.collectFee.execute(
      { roomId: room.id, amountCents: amounts.platformCents },
      tx,
    );

    // Settlement.create verifica que entradas = premios + comisión; si no cuadra, lanza y la transacción entera se deshace.
    return Settlement.create({
      id: randomUUID(),
      matchId: match.id,
      roomId: room.id,
      entryFeeCents: room.entryFeeCents,
      playerCount: players.length,
      prizePoolCents: room.prizePoolCents,
      prizeEachCents: amounts.prizeEachCents,
      platformCents: amounts.platformCents,
      payouts,
    });
  }
}

/**
 * Anula una partida jugada (empate, partida inválida, trampa evidente): NADIE
 * gana, la sala se cancela y se devuelve la entrada a todos.
 */
@Injectable()
export class VoidMatchUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(MATCH_REPOSITORY) private readonly matches: MatchRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(ROOM_EVENTS) private readonly events: RoomEvents,
    private readonly releaseStake: ReleaseStakeUseCase,
  ) {}

  async execute(matchId: string, reason: string): Promise<Match> {
    const known = await this.matches.findById(matchId);
    if (!known) throw new EntityNotFoundException('Partida', matchId);

    const { match, room } = await this.uow.run(async (tx) => {
      const room = await this.rooms.findByIdForUpdate(known.roomId, tx);
      if (!room) throw new EntityNotFoundException('Sala', known.roomId);
      const match = await this.matches.findById(matchId, tx);
      if (!match) throw new EntityNotFoundException('Partida', matchId);

      match.void(reason);
      const refunds = room.voidGame();
      for (const player of [...refunds].sort((a, b) =>
        a.userId.localeCompare(b.userId),
      )) {
        await this.releaseStake.execute(
          {
            userId: player.userId,
            amountCents: room.entryFeeCents,
            referenceType: 'room',
            referenceId: room.id,
            attempt: player.joinId,
          },
          tx,
        );
      }
      await this.matches.save(match, tx);
      await this.rooms.save(room, tx);
      return { match, room };
    });

    this.events.roomChanged(room);
    return match;
  }
}

export type HistoryResult = 'won' | 'lost' | 'refunded';

export interface HistoryEntry {
  matchId: string;
  roomId: string;
  roomName: string;
  mode: Room['mode'];
  at: Date;
  result: HistoryResult;
  yourTeam: 'radiant' | 'dire';
  entryFeeCents: number;
  /** Lo que ganó (0 si perdió o si se reembolsó). */
  prizeCents: number;
  /** Ganancia o pérdida real: premio - entrada (0 si se reembolsó). */
  netCents: number;
  dotaMatchId?: string;
  /** Solo si fue reembolsada: por qué. */
  reason?: string;
}

/** Las partidas ya cerradas de un jugador, con lo que ganó o perdió en cada una. */
@Injectable()
export class ListMyMatchHistoryUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(MATCH_REPOSITORY) private readonly matches: MatchRepository,
    @Inject(SETTLEMENT_REPOSITORY)
    private readonly settlements: SettlementRepository,
  ) {}

  async execute(userId: string, limit = 50): Promise<HistoryEntry[]> {
    const matches = await this.matches.findClosedOfUser(userId, limit);
    const settlements = await this.settlements.findByMatchIds(
      matches.map((m) => m.id),
    );
    const byMatch = new Map(settlements.map((s) => [s.matchId, s]));

    const entries: HistoryEntry[] = [];
    for (const match of matches) {
      const room = await this.rooms.findById(match.roomId);
      const me = match.participantOf(userId);
      if (!room || !me) continue;

      const settlement = byMatch.get(match.id);
      const payout = settlement?.payoutOf(userId);
      // Una partida "terminada" sin liquidar todavía es un instante transitorio: no se muestra hasta que se pague.
      if (match.status === 'finished' && !payout) continue;

      const paid = match.status === 'finished' && payout;
      entries.push({
        matchId: match.id,
        roomId: room.id,
        roomName: room.name,
        mode: room.mode,
        at: match.finishedAt ?? match.updatedAt,
        result: paid ? (payout.won ? 'won' : 'lost') : 'refunded',
        yourTeam: me.team,
        entryFeeCents: room.entryFeeCents,
        prizeCents: paid ? payout.prizeCents : 0,
        netCents: paid ? payout.prizeCents - payout.entryCents : 0,
        dotaMatchId: match.dotaMatchId,
        reason: paid ? undefined : match.failureReason,
      });
    }
    return entries;
  }
}
