import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  type AuditEntry,
  AUDIT_LOG,
  type AuditLog,
} from '../../../../shared/audit/domain/audit-log.port';
import { ACTIVITY_FEED, type ActivityFeed } from '../../../../shared/activity/domain/activity-feed.port';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { USER_REPOSITORY, type UserRepository } from '../../../auth/domain/ports/user.repository.port';
import { AdjustWalletUseCase } from '../../../wallet/application/use-cases/adjust-wallet.use-case';
import { Sanction, type SanctionType } from '../../domain/entities/sanction.entity';
import { TRUST_REPOSITORY, type TrustRepository } from '../../domain/ports/trust.repository.port';

const SANCTION_FEED_LABEL: Record<SanctionType, string> = {
  warning: 'una advertencia',
  fine: 'una multa',
  suspension: 'una suspensión',
};

export interface ApplySanctionInput {
  userId: string;
  type: SanctionType;
  reason: string;
  amountCents?: number;
  suspendedUntil?: Date;
  reportId?: string;
}

/** ¿Está suspendido AHORA MISMO? Lo usan las salas para bloquear crear/unirse. */
@Injectable()
export class IsUserSuspendedUseCase {
  constructor(@Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository) {}

  async execute(userId: string): Promise<Sanction | null> {
    return this.trust.findActiveSuspension(userId, new Date());
  }
}

/** Aplica una sanción. Una multa descuenta saldo real de inmediato (falla si no alcanza). */
@Injectable()
export class ApplySanctionUseCase {
  constructor(
    @Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(ACTIVITY_FEED) private readonly feed: ActivityFeed,
    private readonly adjustWallet: AdjustWalletUseCase,
  ) {}

  async execute(adminId: string, input: ApplySanctionInput): Promise<Sanction> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new EntityNotFoundException('Usuario', input.userId);

    const sanction = await this.uow.run(async (tx) => {
      const sanction = Sanction.create({
        id: randomUUID(),
        userId: user.id,
        userDisplayName: user.displayName,
        type: input.type,
        reason: input.reason,
        amountCents: input.amountCents,
        suspendedUntil: input.suspendedUntil,
        reportId: input.reportId,
        appliedBy: adminId,
      });
      if (sanction.type === 'fine') {
        await this.adjustWallet.execute(
          {
            userId: user.id,
            direction: 'debit',
            amountCents: sanction.amountCents!,
            idempotencyKey: `sanction-fine:${sanction.id}`,
            reason: `Multa: ${sanction.reason}`,
            actorId: adminId,
            referenceType: 'sanction',
            referenceId: sanction.id,
          },
          tx,
        );
      }
      await this.trust.saveSanction(sanction, tx);
      return sanction;
    });

    await this.audit.record(
      this.entry(adminId, 'trust.sanction.apply', sanction.id, {
        userId: sanction.userId,
        type: sanction.type,
        amountCents: sanction.amountCents,
        suspendedUntil: sanction.suspendedUntil?.toISOString(),
        reason: sanction.reason,
      }),
    );
    // El feed público muestra el TIPO, nunca el motivo ni el monto: es transparencia,
    // no exponer los detalles personales de por qué se sancionó a alguien.
    await this.feed.record({
      kind: 'sanction',
      message: `${sanction.userDisplayName} recibió ${SANCTION_FEED_LABEL[sanction.type]}.`,
      targetType: 'user',
      targetId: sanction.userId,
    });
    return sanction;
  }

  private entry(actorId: string, action: string, targetId: string, metadata: Record<string, unknown>): AuditEntry {
    return { actorId, action, targetType: 'sanction', targetId, metadata };
  }
}

@Injectable()
export class RevokeSanctionUseCase {
  constructor(
    @Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    private readonly adjustWallet: AdjustWalletUseCase,
  ) {}

  async execute(adminId: string, sanctionId: string, reason: string): Promise<Sanction> {
    const sanction = await this.uow.run(async (tx) => {
      const sanction = await this.trust.findSanctionForUpdate(sanctionId, tx);
      if (!sanction) throw new EntityNotFoundException('Sanción', sanctionId);
      sanction.revoke(adminId, reason);
      // Revocar una multa devuelve el dinero: es lo justo cuando se aplicó por error.
      if (sanction.type === 'fine') {
        await this.adjustWallet.execute(
          {
            userId: sanction.userId,
            direction: 'credit',
            amountCents: sanction.amountCents!,
            idempotencyKey: `sanction-revoke:${sanction.id}`,
            reason: `Multa revocada: ${reason}`,
            actorId: adminId,
            referenceType: 'sanction',
            referenceId: sanction.id,
          },
          tx,
        );
      }
      await this.trust.saveSanction(sanction, tx);
      return sanction;
    });

    await this.audit.record({
      actorId: adminId,
      action: 'trust.sanction.revoke',
      targetType: 'sanction',
      targetId: sanction.id,
      metadata: { userId: sanction.userId, reason },
    });
    return sanction;
  }
}

@Injectable()
export class ListSanctionsUseCase {
  constructor(@Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository) {}

  listAll(type?: SanctionType) {
    return this.trust.listSanctions(type, 200);
  }

  listOfUser(userId: string) {
    return this.trust.listSanctionsOfUser(userId, 100);
  }
}
