import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUDIT_LOG, type AuditLog } from '../../../../shared/audit/domain/audit-log.port';
import type { AppConfig } from '../../../../config/configuration';
import {
  EntityNotFoundException,
  ForbiddenActionException,
  InvalidDomainStateException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { USER_REPOSITORY, type UserRepository } from '../../../auth/domain/ports/user.repository.port';
import { ReverseSettlementUseCase } from '../../../rooms/application/use-cases/reverse-settlement.use-case';
import { MATCH_REPOSITORY, type MatchRepository } from '../../../rooms/domain/ports/match.repository.port';
import { sniffImage } from '../../../payments/application/use-cases/payment-use-cases';
import { Dispute } from '../../domain/entities/dispute.entity';
import { TRUST_REPOSITORY, type TrustRepository } from '../../domain/ports/trust.repository.port';

const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;

export interface CreateDisputeInput {
  matchId: string;
  reason: string;
}

/** Un jugador de la partida impugna su resultado, dentro de una ventana de tiempo tras terminar. */
@Injectable()
export class CreateDisputeUseCase {
  constructor(
    @Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository,
    @Inject(MATCH_REPOSITORY) private readonly matches: MatchRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async execute(userId: string, input: CreateDisputeInput, file?: { data: Buffer }): Promise<Dispute> {
    const user = await this.users.findById(userId);
    if (!user) throw new EntityNotFoundException('Usuario', userId);

    const match = await this.matches.findById(input.matchId);
    if (!match) throw new EntityNotFoundException('Partida', input.matchId);
    if (!match.participantOf(userId)) {
      throw new ForbiddenActionException('Solo un jugador de esta partida puede impugnarla.');
    }
    if (match.status !== 'finished') {
      throw new InvalidDomainStateException('Solo se puede impugnar una partida ya terminada y pagada.');
    }
    const windowHours = this.config.get('disputes', { infer: true }).windowHours;
    const deadline = (match.finishedAt ?? match.updatedAt).getTime() + windowHours * 60 * 60 * 1000;
    if (Date.now() > deadline) {
      throw new InvalidDomainStateException(
        `Ya pasó el plazo para impugnar esta partida (${windowHours} horas desde que terminó).`,
      );
    }
    if (await this.trust.findDisputeByMatchId(input.matchId)) {
      throw new InvalidDomainStateException('Esta partida ya tiene una disputa registrada.');
    }

    let evidence: { contentType: string; data: Buffer } | null = null;
    if (file?.data?.length) {
      if (file.data.length > MAX_EVIDENCE_BYTES) {
        throw new InvalidDomainStateException('La evidencia pesa demasiado (máximo 2 MB).');
      }
      const contentType = sniffImage(file.data);
      if (!contentType) throw new InvalidDomainStateException('La evidencia debe ser una imagen PNG, JPG o WEBP.');
      evidence = { contentType, data: file.data };
    }

    const dispute = Dispute.create({
      id: randomUUID(),
      matchId: match.id,
      roomId: match.roomId,
      raisedBy: user.id,
      raisedByDisplayName: user.displayName,
      reason: input.reason,
      hasEvidence: evidence !== null,
    });
    await this.trust.saveDispute(dispute);
    if (evidence) await this.trust.saveDisputeEvidence(dispute.id, evidence);
    return dispute;
  }
}

@Injectable()
export class ListDisputesUseCase {
  constructor(@Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository) {}

  listPendingAndAll(view: 'pending' | 'all') {
    return this.trust.listDisputes(view === 'pending' ? 'pending' : undefined, 200);
  }
}

@Injectable()
export class GetDisputeEvidenceUseCase {
  constructor(@Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository) {}

  async execute(disputeId: string) {
    const evidence = await this.trust.getDisputeEvidence(disputeId);
    if (!evidence) throw new EntityNotFoundException('Evidencia', disputeId);
    return evidence;
  }
}

/**
 * Resuelve una disputa. 'upheld': se revierte la liquidación entera (nadie
 * se queda con el premio, todos recuperan su entrada, la plataforma
 * devuelve su comisión). 'rejected': el resultado se mantiene tal cual.
 * No redeclara un ganador distinto — eso evitaría tener que adivinar quién
 * ganó de verdad sin datos confiables del juego.
 */
@Injectable()
export class ResolveDisputeUseCase {
  constructor(
    @Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    private readonly reverseSettlement: ReverseSettlementUseCase,
  ) {}

  async uphold(adminId: string, disputeId: string, note: string): Promise<Dispute> {
    const dispute = await this.trust.findDispute(disputeId);
    if (!dispute) throw new EntityNotFoundException('Disputa', disputeId);
    if (dispute.status !== 'pending') throw new InvalidDomainStateException('Esta disputa ya fue resuelta.');

    await this.reverseSettlement.execute(dispute.matchId, adminId, note || dispute.reason);
    dispute.uphold(adminId, note);
    await this.trust.saveDispute(dispute);

    await this.audit.record({
      actorId: adminId,
      action: 'trust.dispute.uphold',
      targetType: 'dispute',
      targetId: dispute.id,
      metadata: { matchId: dispute.matchId, note },
    });
    return dispute;
  }

  async reject(adminId: string, disputeId: string, note: string): Promise<Dispute> {
    const dispute = await this.trust.findDispute(disputeId);
    if (!dispute) throw new EntityNotFoundException('Disputa', disputeId);
    dispute.reject(adminId, note);
    await this.trust.saveDispute(dispute);

    await this.audit.record({
      actorId: adminId,
      action: 'trust.dispute.reject',
      targetType: 'dispute',
      targetId: dispute.id,
      metadata: { matchId: dispute.matchId, note },
    });
    return dispute;
  }
}
