import { Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import type { LedgerEntryType } from '../../domain/entities/ledger-entry.entity';
import {
  type AppendResult,
  type WalletRepository,
  WALLET_REPOSITORY,
} from '../../domain/ports/wallet.repository.port';

export interface PaymentMovement {
  userId: string;
  amountCents: number;
  /** Id del pedido de recarga o de retiro: con él se arma la clave de idempotencia. */
  requestId: string;
  /** Quién lo aprobó/originó (admin, el propio usuario o "system"). */
  actorId: string;
  description: string;
}

async function move(
  wallets: WalletRepository,
  type: LedgerEntryType,
  keyPrefix: string,
  referenceType: 'deposit' | 'withdrawal',
  input: PaymentMovement,
  tx?: TransactionContext,
): Promise<AppendResult> {
  const wallet = await wallets.getOrCreateForUser(input.userId, 'user', tx);
  return wallets.append(
    wallet.id,
    {
      type,
      amountCents: input.amountCents,
      referenceType,
      referenceId: input.requestId,
      // Un pedido = una sola vez: aprobar dos veces el mismo pedido no acredita dos veces.
      idempotencyKey: `${keyPrefix}:${input.requestId}`,
      description: input.description,
      createdBy: input.actorId,
    },
    tx,
  );
}

/** El admin confirmó que llegó el pago: se acredita el saldo. */
@Injectable()
export class CreditDepositUseCase {
  constructor(@Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository) {}

  execute(input: PaymentMovement, tx?: TransactionContext): Promise<AppendResult> {
    return move(this.wallets, 'DEPOSIT', 'deposit', 'deposit', input, tx);
  }
}

/** El usuario pidió retirar: el dinero se aparta (disponible → bloqueado) hasta que el admin lo pague o lo rechace. */
@Injectable()
export class HoldWithdrawalUseCase {
  constructor(@Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository) {}

  execute(input: PaymentMovement, tx?: TransactionContext): Promise<AppendResult> {
    return move(this.wallets, 'WITHDRAWAL_HOLD', 'withdrawal-hold', 'withdrawal', input, tx);
  }
}

/** El retiro se rechazó o el usuario lo canceló: el dinero vuelve a estar disponible. */
@Injectable()
export class ReleaseWithdrawalUseCase {
  constructor(@Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository) {}

  execute(input: PaymentMovement, tx?: TransactionContext): Promise<AppendResult> {
    return move(this.wallets, 'WITHDRAWAL_RELEASE', 'withdrawal-release', 'withdrawal', input, tx);
  }
}

/** El admin ya transfirió el dinero al usuario: el monto apartado sale del sistema. */
@Injectable()
export class PayWithdrawalUseCase {
  constructor(@Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository) {}

  execute(input: PaymentMovement, tx?: TransactionContext): Promise<AppendResult> {
    return move(this.wallets, 'WITHDRAWAL_PAID', 'withdrawal-paid', 'withdrawal', input, tx);
  }
}
