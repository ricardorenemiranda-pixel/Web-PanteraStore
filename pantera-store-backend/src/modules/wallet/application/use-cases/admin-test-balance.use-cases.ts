import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../config/configuration';
import {
  EntityNotFoundException,
  InvalidDomainStateException,
} from '../../../../shared/domain/exceptions/domain.exception';
import type { User } from '../../../auth/domain/entities/user.entity';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../auth/domain/ports/user.repository.port';
import {
  type AppendResult,
  type WalletRepository,
  WALLET_REPOSITORY,
} from '../../domain/ports/wallet.repository.port';
import { GetWalletUseCase, type WalletView } from './get-wallet.use-case';

/** Tope por operación, para que un error de tipeo no acredite una fortuna. */
export const MAX_TEST_CREDIT_CENTS = 1_000_000; // S/ 10,000

export interface UserWalletView extends WalletView {
  user: User;
}

/** El admin identifica al jugador por id interno, SteamID64 o email. */
@Injectable()
export class LookupWalletUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly getWallet: GetWalletUseCase,
  ) {}

  async execute(query: string): Promise<UserWalletView> {
    const q = query.trim();
    const user =
      (await this.users.findById(q)) ??
      (await this.users.findBySteamId(q)) ??
      (await this.users.findByEmail(q.toLowerCase()));
    if (!user) throw new EntityNotFoundException('Usuario', q);
    return { user, ...(await this.getWallet.execute(user.id)) };
  }
}

export interface CreditTestBalanceInput {
  adminId: string;
  userQuery: string;
  amountCents: number;
  reason: string;
  /** Generado por el panel en cada envío: un doble clic no acredita dos veces. */
  requestId: string;
}

/**
 * Saldo de PRUEBA para desarrollo y piloto: se registra como ADJUSTMENT en el
 * libro (con el admin y el motivo), no como recarga real. Se desactiva con
 * WALLET_TEST_CREDITS_ENABLED=false (por defecto ya está apagado en producción).
 */
@Injectable()
export class CreditTestBalanceUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository,
    private readonly lookup: LookupWalletUserUseCase,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async execute(
    input: CreditTestBalanceInput,
  ): Promise<AppendResult & { user: User }> {
    if (!this.config.get('wallet', { infer: true }).testCreditsEnabled) {
      throw new InvalidDomainStateException(
        'El saldo de prueba está desactivado en este entorno.',
      );
    }
    if (input.amountCents > MAX_TEST_CREDIT_CENTS) {
      throw new InvalidDomainStateException(
        'El monto supera el máximo permitido por operación.',
      );
    }
    const { user, wallet } = await this.lookup.execute(input.userQuery);
    const result = await this.wallets.append(wallet.id, {
      type: 'ADJUSTMENT',
      direction: 'credit',
      amountCents: input.amountCents,
      referenceType: 'test-credit',
      referenceId: input.requestId,
      idempotencyKey: `test-credit:${input.requestId}`,
      description: `Saldo de prueba: ${input.reason.trim()}`,
      createdBy: input.adminId,
    });
    return { ...result, user };
  }
}
