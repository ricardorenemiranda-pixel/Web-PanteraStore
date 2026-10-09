import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG, type AuditLog } from '../../../../shared/audit/domain/audit-log.port';
import { InvalidDomainStateException, EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { USER_REPOSITORY, type UserRepository } from '../../../auth/domain/ports/user.repository.port';
import { Report, type ReportCategory } from '../../domain/entities/report.entity';
import { TRUST_REPOSITORY, type TrustRepository } from '../../domain/ports/trust.repository.port';
import { sniffImage } from '../../../payments/application/use-cases/payment-use-cases';

const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;

export interface CreateReportInput {
  reportedUserId: string;
  roomId?: string;
  matchId?: string;
  category: ReportCategory;
  description: string;
}

@Injectable()
export class CreateReportUseCase {
  constructor(
    @Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(reporterId: string, input: CreateReportInput, file?: { data: Buffer }): Promise<Report> {
    const [reporter, reported] = await Promise.all([
      this.users.findById(reporterId),
      this.users.findById(input.reportedUserId),
    ]);
    if (!reporter) throw new EntityNotFoundException('Usuario', reporterId);
    if (!reported) throw new EntityNotFoundException('Usuario', input.reportedUserId);

    let evidence: { contentType: string; data: Buffer } | null = null;
    if (file?.data?.length) {
      if (file.data.length > MAX_EVIDENCE_BYTES) {
        throw new InvalidDomainStateException('La evidencia pesa demasiado (máximo 2 MB).');
      }
      const contentType = sniffImage(file.data);
      if (!contentType) {
        throw new InvalidDomainStateException('La evidencia debe ser una imagen PNG, JPG o WEBP.');
      }
      evidence = { contentType, data: file.data };
    }

    const report = Report.create({
      id: randomUUID(),
      reporterId: reporter.id,
      reporterDisplayName: reporter.displayName,
      reportedUserId: reported.id,
      reportedDisplayName: reported.displayName,
      roomId: input.roomId,
      matchId: input.matchId,
      category: input.category,
      description: input.description,
      hasEvidence: evidence !== null,
    });
    await this.trust.saveReport(report, evidence);
    return report;
  }
}

@Injectable()
export class ListReportsUseCase {
  constructor(@Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository) {}

  listPendingAndAll(view: 'pending' | 'all') {
    return this.trust.listReports(view === 'pending' ? 'pending' : undefined, 200);
  }

  listAboutUser(userId: string) {
    return this.trust.listReportsAbout(userId, 100);
  }
}

@Injectable()
export class GetReportEvidenceUseCase {
  constructor(@Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository) {}

  async execute(reportId: string) {
    const evidence = await this.trust.getReportEvidence(reportId);
    if (!evidence) throw new EntityNotFoundException('Evidencia', reportId);
    return evidence;
  }
}

/** El admin cierra un reporte: lo descarta, o lo resuelve (opcionalmente referenciando la sanción que aplicó). */
@Injectable()
export class ReviewReportUseCase {
  constructor(
    @Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async resolve(adminId: string, reportId: string, note: string, sanctionId?: string): Promise<Report> {
    const report = await this.trust.findReport(reportId);
    if (!report) throw new EntityNotFoundException('Reporte', reportId);
    report.resolve(adminId, note, sanctionId);
    await this.trust.saveReport(report, null);
    await this.audit.record({
      actorId: adminId,
      action: 'trust.report.resolve',
      targetType: 'report',
      targetId: report.id,
      metadata: { reportedUserId: report.reportedUserId, sanctionId },
    });
    return report;
  }

  async dismiss(adminId: string, reportId: string, note: string): Promise<Report> {
    const report = await this.trust.findReport(reportId);
    if (!report) throw new EntityNotFoundException('Reporte', reportId);
    report.dismiss(adminId, note);
    await this.trust.saveReport(report, null);
    await this.audit.record({
      actorId: adminId,
      action: 'trust.report.dismiss',
      targetType: 'report',
      targetId: report.id,
      metadata: { reportedUserId: report.reportedUserId },
    });
    return report;
  }
}
