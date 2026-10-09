import { Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import type { LedgerEntryType } from '../../domain/entities/ledger-entry.entity';
import {
  type AppendResult,
  type WalletRepository,
  WALLET_REPOSITORY,
} from '../../domain/ports/wallet.repository.port';

/** A qué se debe el movimiento (ej. una sala). Junto con el usuario, identifica la operación. */
export interface StakeReference {
  userId: string;
  amountCents: number;
  referenceType: string;
  referenceId: string;
  /**
   * Distingue dos veces que el mismo usuario entra a la misma sala (entra,
   * sale, vuelve a entrar): cada participación es una operación distinta.
   */
  attempt?: string;
}

/**
 * La clave de idempotencia sale de (operación + referencia + usuario +
 * participación): pedir dos veces "bloquear la entrada del usuario X a la sala
 * Y" mueve la plata UNA sola vez. Con `tx`, el movimiento se suma a la
 * transacción del que llama (todo o nada); sin `tx`, abre la suya.
 */
async function moveForReference(
  wallets: WalletRepository,
  type: LedgerEntryType,
  keyPrefix: string,
  createdBy: string,
  input: StakeReference,
  description: string,
  tx?: TransactionContext,
): Promise<AppendResult> {
  const wallet = await wallets.getOrCreateForUser(input.userId, 'user', tx);
  const attempt = input.attempt ? `:${input.attempt}` : '';
  return wallets.append(
    wallet.id,
    {
      type,
      amountCents: input.amountCents,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: `${keyPrefix}:${input.referenceType}:${input.referenceId}:${input.userId}${attempt}`,
      description,
      createdBy,
    },
    tx,
  );
}

/** El jugador entra a una sala: su entrada pasa de "disponible" a "bloqueado". */
@Injectable()
export class LockStakeUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository,
  ) {}

  execute(
    input: StakeReference,
    tx?: TransactionContext,
  ): Promise<AppendResult> {
    return moveForReference(
      this.wallets,
      'STAKE_LOCK',
      'stake-lock',
      input.userId,
      input,
      'Entrada bloqueada',
      tx,
    );
  }
}

/** La sala se cancela o el jugador sale antes de empezar: vuelve a "disponible". */
@Injectable()
export class ReleaseStakeUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository,
  ) {}

  execute(
    input: StakeReference,
    tx?: TransactionContext,
  ): Promise<AppendResult> {
    return moveForReference(
      this.wallets,
      'STAKE_RELEASE',
      'stake-release',
      'system',
      input,
      'Entrada devuelta',
      tx,
    );
  }
}

/** La partida se jugó: la entrada bloqueada se consume. */
@Injectable()
export class ChargeStakeUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository,
  ) {}

  execute(
    input: StakeReference,
    tx?: TransactionContext,
  ): Promise<AppendResult> {
    return moveForReference(
      this.wallets,
      'STAKE_CHARGE',
      'stake-charge',
      'system',
      input,
      'Entrada cobrada',
      tx,
    );
  }
}

/** Premio para un ganador: entra a "disponible". */
@Injectable()
export class PayPrizeUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository,
  ) {}

  execute(
    input: StakeReference,
    tx?: TransactionContext,
  ): Promise<AppendResult> {
    return moveForReference(
      this.wallets,
      'PRIZE',
      'prize',
      'system',
      input,
      'Premio',
      tx,
    );
  }
}

export const PLATFORM_WALLET_USER_ID = 'platform';

/** La comisión de una sala llega a la billetera de la plataforma (una vez por sala). */
@Injectable()
export class CollectPlatformFeeUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository,
  ) {}

  async execute(
    input: { roomId: string; amountCents: number },
    tx?: TransactionContext,
  ): Promise<AppendResult | null> {
    // Sin comisión (0%) y sin sobrante, no hay nada que cobrar.
    if (input.amountCents === 0) return null;
    const wallet = await this.wallets.getOrCreateForUser(
      PLATFORM_WALLET_USER_ID,
      'platform',
      tx,
    );
    return this.wallets.append(
      wallet.id,
      {
        type: 'PLATFORM_FEE',
        amountCents: input.amountCents,
        referenceType: 'room',
        referenceId: input.roomId,
        idempotencyKey: `platform-fee:room:${input.roomId}`,
        description: 'Comisión de sala',
        createdBy: 'system',
      },
      tx,
    );
  }
}
