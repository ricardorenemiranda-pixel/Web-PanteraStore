import { Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import type { AdjustmentDirection } from '../../domain/entities/ledger-entry.entity';
import {
  type AppendResult,
  type WalletRepository,
  WALLET_REPOSITORY,
} from '../../domain/ports/wallet.repository.port';

export interface AdjustWalletInput {
  userId: string;
  direction: AdjustmentDirection;
  amountCents: number;
  /** Único por operación: reintentar el mismo ajuste no lo aplica dos veces. */
  idempotencyKey: string;
  reason: string;
  actorId: string;
  referenceType?: string;
  referenceId?: string;
}

/**
 * Ajuste REAL de saldo (a diferencia del saldo de prueba de admin-test-balance,
 * que solo existe para desarrollo/piloto). Lo usan correcciones legítimas:
 * revertir una liquidación por una disputa ganada, compensar un error, etc.
 * Siempre exige un motivo — queda en el libro de movimientos para siempre.
 */
@Injectable()
export class AdjustWalletUseCase {
  constructor(@Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository) {}

  async execute(input: AdjustWalletInput, tx?: TransactionContext): Promise<AppendResult> {
    if (!input.reason.trim()) {
      throw new InvalidDomainStateException('Un ajuste de saldo siempre debe llevar un motivo.');
    }
    const wallet = await this.wallets.getOrCreateForUser(input.userId, 'user', tx);
    return this.wallets.append(
      wallet.id,
      {
        type: 'ADJUSTMENT',
        direction: input.direction,
        amountCents: input.amountCents,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        idempotencyKey: input.idempotencyKey,
        description: input.reason,
        createdBy: input.actorId,
      },
      tx,
    );
  }
}
