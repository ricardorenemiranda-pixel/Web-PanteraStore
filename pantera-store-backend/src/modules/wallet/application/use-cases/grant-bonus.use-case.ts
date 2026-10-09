import { Inject, Injectable } from '@nestjs/common';
import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { ACTIVITY_FEED, type ActivityFeed } from '../../../../shared/activity/domain/activity-feed.port';
import { AUDIT_LOG, type AuditLog } from '../../../../shared/audit/domain/audit-log.port';
import type { User } from '../../../auth/domain/entities/user.entity';
import { type AppendResult, type WalletRepository, WALLET_REPOSITORY } from '../../domain/ports/wallet.repository.port';
import { LookupWalletUserUseCase } from './admin-test-balance.use-cases';

export const MAX_BONUS_CENTS = 1_000_000; // S/ 10,000

export interface GrantBonusInput {
  adminId: string;
  userQuery: string;
  amountCents: number;
  reason: string;
  /** Generado por el panel en cada envío: un doble clic no acredita dos veces. */
  requestId: string;
}

/**
 * Bono REAL (a diferencia de admin/test-credit, que es solo saldo de
 * prueba). Queda en el libro como ADJUSTMENT y se anuncia en el feed de
 * actividad público — a diferencia de una corrección interna (reversión de
 * disputa, etc.), un bono es intencionalmente visible.
 */
@Injectable()
export class GrantBonusUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository,
    @Inject(ACTIVITY_FEED) private readonly feed: ActivityFeed,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    private readonly lookup: LookupWalletUserUseCase,
  ) {}

  async execute(input: GrantBonusInput): Promise<AppendResult & { user: User }> {
    if (input.amountCents <= 0 || input.amountCents > MAX_BONUS_CENTS) {
      throw new InvalidDomainStateException('El monto del bono no es válido.');
    }
    const { user, wallet } = await this.lookup.execute(input.userQuery);
    const result = await this.wallets.append(wallet.id, {
      type: 'ADJUSTMENT',
      direction: 'credit',
      amountCents: input.amountCents,
      referenceType: 'bonus',
      referenceId: input.requestId,
      idempotencyKey: `bonus:${input.requestId}`,
      description: `Bono: ${input.reason.trim()}`,
      createdBy: input.adminId,
    });

    await this.feed.record({
      kind: 'bonus',
      message: `${user.displayName} recibió un bono.`,
      targetType: 'user',
      targetId: user.id,
    });
    await this.audit.record({
      actorId: input.adminId,
      action: 'wallet.bonus.grant',
      targetType: 'user',
      targetId: user.id,
      metadata: { amountCents: input.amountCents, reason: input.reason },
    });

    return { ...result, user };
  }
}
