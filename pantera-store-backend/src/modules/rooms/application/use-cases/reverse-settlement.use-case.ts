import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { AdjustWalletUseCase } from '../../../wallet/application/use-cases/adjust-wallet.use-case';
import type { Match } from '../../domain/entities/match.entity';
import { markSettlementReversed, type Settlement } from '../../domain/entities/settlement.entity';
import { ROOM_EVENTS, type RoomEvents } from '../../domain/ports/room-events.port';
import { MATCH_REPOSITORY, type MatchRepository } from '../../domain/ports/match.repository.port';
import { ROOM_REPOSITORY, type RoomRepository } from '../../domain/ports/room.repository.port';
import {
  SETTLEMENT_REPOSITORY,
  type SettlementRepository,
} from '../../domain/ports/settlement.repository.port';

export interface ReversalResult {
  match: Match;
  settlement: Settlement;
}

/**
 * Deshace por completo una liquidación ya pagada, porque una disputa se
 * aceptó: a cada jugador se le devuelve la entrada, a quien ganó se le quita
 * el premio, y la plataforma devuelve su comisión. Todo con ADJUSTMENT (no
 * con los movimientos de sala, porque el ciclo bloqueo→cobro ya se cerró).
 *
 * Idempotente: si la liquidación ya estaba revertida, no vuelve a mover
 * nada (evita cobrar/pagar dos veces si la corrección se reintenta).
 */
@Injectable()
export class ReverseSettlementUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(MATCH_REPOSITORY) private readonly matches: MatchRepository,
    @Inject(SETTLEMENT_REPOSITORY) private readonly settlements: SettlementRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(ROOM_EVENTS) private readonly events: RoomEvents,
    private readonly adjustWallet: AdjustWalletUseCase,
  ) {}

  async execute(matchId: string, adminId: string, reason: string): Promise<ReversalResult> {
    const known = await this.matches.findById(matchId);
    if (!known) throw new EntityNotFoundException('Partida', matchId);

    const { match, settlement, room, alreadyDone } = await this.uow.run(async (tx) => {
      const room = await this.rooms.findByIdForUpdate(known.roomId, tx);
      if (!room) throw new EntityNotFoundException('Sala', known.roomId);

      const settlement = await this.settlements.findByMatchId(matchId, tx);
      if (!settlement) throw new EntityNotFoundException('Liquidación de la partida', matchId);

      if (settlement.isReversed) {
        const match = await this.matches.findById(matchId, tx);
        return { match: match!, settlement, room, alreadyDone: true };
      }

      // Siempre en el mismo orden (por usuario): evita bloqueos cruzados con otras correcciones.
      for (const payout of [...settlement.payouts].sort((a, b) => a.userId.localeCompare(b.userId))) {
        await this.adjustWallet.execute(
          {
            userId: payout.userId,
            direction: 'credit',
            amountCents: payout.entryCents,
            idempotencyKey: `dispute-reverse-entry:${settlement.id}:${payout.userId}`,
            reason: `Corrección por disputa: se devuelve tu entrada (${reason})`,
            actorId: adminId,
            referenceType: 'settlement-reversal',
            referenceId: settlement.id,
          },
          tx,
        );
        if (payout.won && payout.prizeCents > 0) {
          await this.adjustWallet.execute(
            {
              userId: payout.userId,
              direction: 'debit',
              amountCents: payout.prizeCents,
              idempotencyKey: `dispute-reverse-prize:${settlement.id}:${payout.userId}`,
              reason: `Corrección por disputa: se retira el premio pagado (${reason})`,
              actorId: adminId,
              referenceType: 'settlement-reversal',
              referenceId: settlement.id,
            },
            tx,
          );
        }
      }
      if (settlement.platformCents > 0) {
        await this.adjustWallet.execute(
          {
            userId: 'platform',
            direction: 'debit',
            amountCents: settlement.platformCents,
            idempotencyKey: `dispute-reverse-fee:${settlement.id}`,
            reason: `Corrección por disputa: se devuelve la comisión de la sala (${reason})`,
            actorId: adminId,
            referenceType: 'settlement-reversal',
            referenceId: settlement.id,
          },
          tx,
        );
      }

      const match = await this.matches.findById(matchId, tx);
      if (!match) throw new EntityNotFoundException('Partida', matchId);
      match.voidAfterSettlement(reason);
      room.reverseFinish();

      await this.settlements.save(markSettlementReversed(settlement, adminId), tx);
      await this.matches.save(match, tx);
      await this.rooms.save(room, tx);
      return { match, settlement, room, alreadyDone: false };
    });

    if (!alreadyDone) this.events.roomChanged(room);
    return { match, settlement };
  }
}
