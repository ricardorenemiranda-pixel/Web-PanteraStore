import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, LessThan, MoreThan, Or } from 'typeorm';
import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import { managerOf } from '../../../../shared/infrastructure/typeorm-unit-of-work';
import { Dispute, type DisputeStatus } from '../../domain/entities/dispute.entity';
import { Report, type ReportStatus } from '../../domain/entities/report.entity';
import { Sanction, type SanctionType } from '../../domain/entities/sanction.entity';
import type {
  CollusionPair,
  DuplicateAccountGroup,
  EvidenceFile,
  TrustRepository,
} from '../../domain/ports/trust.repository.port';
import {
  DisputeEvidenceOrmEntity,
  DisputeOrmEntity,
  ReportEvidenceOrmEntity,
  ReportOrmEntity,
  SanctionOrmEntity,
} from './orm/trust.orm-entities';

const clamp = (limit: number | undefined, dflt = 100, max = 300) => Math.min(Math.max(limit ?? dflt, 1), max);

@Injectable()
export class TypeOrmTrustRepository implements TrustRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private mgr(tx?: TransactionContext): EntityManager {
    return tx ? managerOf(tx) : this.dataSource.manager;
  }

  // --------------------------------------------------------------- reportes

  async saveReport(report: Report, evidence: EvidenceFile | null, tx?: TransactionContext): Promise<void> {
    const manager = this.mgr(tx);
    await manager.save(ReportOrmEntity, this.reportToOrm(report));
    if (evidence) {
      const row = new ReportEvidenceOrmEntity();
      row.reportId = report.id;
      row.contentType = evidence.contentType;
      row.data = evidence.data;
      await manager.save(ReportEvidenceOrmEntity, row);
    }
  }

  async findReport(id: string, tx?: TransactionContext): Promise<Report | null> {
    const row = await this.mgr(tx).findOne(ReportOrmEntity, { where: { id } });
    return row ? this.reportToDomain(row) : null;
  }

  async findReportForUpdate(id: string, tx: TransactionContext): Promise<Report | null> {
    const row = await managerOf(tx).findOne(ReportOrmEntity, { where: { id }, lock: { mode: 'pessimistic_write' } });
    return row ? this.reportToDomain(row) : null;
  }

  async listReports(status?: ReportStatus, limit?: number): Promise<Report[]> {
    const rows = await this.dataSource.manager.find(ReportOrmEntity, {
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: clamp(limit),
    });
    return rows.map((r) => this.reportToDomain(r));
  }

  async listReportsAbout(userId: string, limit?: number): Promise<Report[]> {
    const rows = await this.dataSource.manager.find(ReportOrmEntity, {
      where: { reportedUserId: userId },
      order: { createdAt: 'DESC' },
      take: clamp(limit),
    });
    return rows.map((r) => this.reportToDomain(r));
  }

  async getReportEvidence(reportId: string): Promise<EvidenceFile | null> {
    const row = await this.dataSource.manager.findOne(ReportEvidenceOrmEntity, { where: { reportId } });
    return row ? { contentType: row.contentType, data: row.data } : null;
  }

  // -------------------------------------------------------------- sanciones

  async saveSanction(sanction: Sanction, tx?: TransactionContext): Promise<void> {
    await this.mgr(tx).save(SanctionOrmEntity, this.sanctionToOrm(sanction));
  }

  async findSanction(id: string, tx?: TransactionContext): Promise<Sanction | null> {
    const row = await this.mgr(tx).findOne(SanctionOrmEntity, { where: { id } });
    return row ? this.sanctionToDomain(row) : null;
  }

  async findSanctionForUpdate(id: string, tx: TransactionContext): Promise<Sanction | null> {
    const row = await managerOf(tx).findOne(SanctionOrmEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return row ? this.sanctionToDomain(row) : null;
  }

  async listSanctions(type?: SanctionType, limit?: number): Promise<Sanction[]> {
    const rows = await this.dataSource.manager.find(SanctionOrmEntity, {
      where: type ? { type } : {},
      order: { appliedAt: 'DESC' },
      take: clamp(limit),
    });
    return rows.map((r) => this.sanctionToDomain(r));
  }

  async listSanctionsOfUser(userId: string, limit?: number): Promise<Sanction[]> {
    const rows = await this.dataSource.manager.find(SanctionOrmEntity, {
      where: { userId },
      order: { appliedAt: 'DESC' },
      take: clamp(limit),
    });
    return rows.map((r) => this.sanctionToDomain(r));
  }

  async findActiveSuspension(userId: string, now: Date): Promise<Sanction | null> {
    const row = await this.dataSource.manager.findOne(SanctionOrmEntity, {
      where: {
        userId,
        type: 'suspension',
        revokedAt: IsNull(),
        suspendedUntil: Or(IsNull(), MoreThan(now)),
      },
      order: { appliedAt: 'DESC' },
    });
    return row ? this.sanctionToDomain(row) : null;
  }

  // --------------------------------------------------------------- disputas

  async saveDispute(dispute: Dispute, tx?: TransactionContext): Promise<void> {
    await this.mgr(tx).save(DisputeOrmEntity, this.disputeToOrm(dispute));
  }

  async findDispute(id: string, tx?: TransactionContext): Promise<Dispute | null> {
    const row = await this.mgr(tx).findOne(DisputeOrmEntity, { where: { id } });
    return row ? this.disputeToDomain(row) : null;
  }

  async findDisputeForUpdate(id: string, tx: TransactionContext): Promise<Dispute | null> {
    const row = await managerOf(tx).findOne(DisputeOrmEntity, { where: { id }, lock: { mode: 'pessimistic_write' } });
    return row ? this.disputeToDomain(row) : null;
  }

  async findDisputeByMatchId(matchId: string): Promise<Dispute | null> {
    const row = await this.dataSource.manager.findOne(DisputeOrmEntity, { where: { matchId } });
    return row ? this.disputeToDomain(row) : null;
  }

  async listDisputes(status?: DisputeStatus, limit?: number): Promise<Dispute[]> {
    const rows = await this.dataSource.manager.find(DisputeOrmEntity, {
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: clamp(limit),
    });
    return rows.map((r) => this.disputeToDomain(r));
  }

  async saveDisputeEvidence(disputeId: string, evidence: EvidenceFile): Promise<void> {
    const row = new DisputeEvidenceOrmEntity();
    row.disputeId = disputeId;
    row.contentType = evidence.contentType;
    row.data = evidence.data;
    await this.dataSource.manager.save(DisputeEvidenceOrmEntity, row);
  }

  async getDisputeEvidence(disputeId: string): Promise<EvidenceFile | null> {
    const row = await this.dataSource.manager.findOne(DisputeEvidenceOrmEntity, { where: { disputeId } });
    return row ? { contentType: row.contentType, data: row.data } : null;
  }

  // -------------------------------------------------------------- antifraude

  async findDuplicateAccountGroups(): Promise<DuplicateAccountGroup[]> {
    const byIp = await this.dataSource.manager.query(`
      SELECT u."lastLoginIp" AS key, array_agg(u.id) AS ids, array_agg(u."displayName") AS names
        FROM users u
       WHERE u."lastLoginIp" IS NOT NULL
       GROUP BY u."lastLoginIp"
      HAVING COUNT(*) > 1
    `);
    const byDestination = await this.dataSource.manager.query(`
      SELECT w.destination AS key, array_agg(DISTINCT w."userId") AS ids
        FROM withdrawal_requests w
       WHERE w.status IN ('pending', 'paid')
       GROUP BY w.destination
      HAVING COUNT(DISTINCT w."userId") > 1
    `);
    const names = new Map<string, string>();
    if (byDestination.length > 0) {
      const ids = [...new Set(byDestination.flatMap((r: { ids: string[] }) => r.ids))];
      const users = await this.dataSource.manager.query(
        `SELECT id, "displayName" FROM users WHERE id = ANY($1)`,
        [ids],
      );
      for (const u of users as { id: string; displayName: string }[]) names.set(u.id, u.displayName);
    }

    const groups: DuplicateAccountGroup[] = [];
    for (const row of byIp as { key: string; ids: string[]; names: string[] }[]) {
      groups.push({ key: row.key, kind: 'login_ip', userIds: row.ids, userDisplayNames: row.names });
    }
    for (const row of byDestination as { key: string; ids: string[] }[]) {
      groups.push({
        key: row.key,
        kind: 'withdrawal_destination',
        userIds: row.ids,
        userDisplayNames: row.ids.map((id) => names.get(id) ?? id),
      });
    }
    return groups;
  }

  async findCollusionCandidates(minMatchesTogether: number, minBWinRate: number): Promise<CollusionPair[]> {
    // Para cada par de jugadores que compartieron equipo en >= N partidas terminadas,
    // cuenta cuántas veces ganó cada uno cuando iban juntos. Un ratio muy desbalanceado
    // (uno casi siempre pierde para que el otro gane) es la señal de "farming".
    const rows = await this.dataSource.manager.query(
      `
      WITH teammates AS (
        SELECT m.id AS "matchId", m.outcome,
               (p->>'userId') AS "userId", (p->>'team') AS team
          FROM matches m, jsonb_array_elements(m.participants) AS p
         WHERE m.status = 'finished'
      ),
      pairs AS (
        SELECT a."matchId", a.outcome, a."userId" AS a_id, b."userId" AS b_id, a.team
          FROM teammates a
          JOIN teammates b
            ON a."matchId" = b."matchId" AND a.team = b.team AND a."userId" < b."userId"
      )
      SELECT a_id AS "userIdA", b_id AS "userIdB",
             COUNT(*)::int AS "sameTeamCount",
             SUM(CASE WHEN outcome = team THEN 1 ELSE 0 END)::int AS "bWinsWhenSameTeam"
        FROM pairs
       GROUP BY a_id, b_id
      HAVING COUNT(*) >= $1
    `,
      [minMatchesTogether],
    );

    if (rows.length === 0) return [];
    const ids = [...new Set(rows.flatMap((r: { userIdA: string; userIdB: string }) => [r.userIdA, r.userIdB]))];
    const users = await this.dataSource.manager.query(`SELECT id, "displayName" FROM users WHERE id = ANY($1)`, [
      ids,
    ]);
    const names = new Map((users as { id: string; displayName: string }[]).map((u) => [u.id, u.displayName]));

    return (rows as { userIdA: string; userIdB: string; sameTeamCount: number; bWinsWhenSameTeam: number }[])
      .filter((r) => r.bWinsWhenSameTeam / r.sameTeamCount >= minBWinRate)
      .map((r) => ({
        userIdA: r.userIdA,
        userDisplayNameA: names.get(r.userIdA) ?? r.userIdA,
        userIdB: r.userIdB,
        userDisplayNameB: names.get(r.userIdB) ?? r.userIdB,
        matchesTogether: r.sameTeamCount,
        sameTeamCount: r.sameTeamCount,
        bWinsWhenSameTeam: r.bWinsWhenSameTeam,
      }));
  }

  // ---------------------------------------------------------------- mapeos

  private reportToOrm(r: Report): ReportOrmEntity {
    const row = new ReportOrmEntity();
    row.id = r.id;
    row.reporterId = r.reporterId;
    row.reporterDisplayName = r.reporterDisplayName;
    row.reportedUserId = r.reportedUserId;
    row.reportedDisplayName = r.reportedDisplayName;
    row.roomId = r.roomId ?? null;
    row.matchId = r.matchId ?? null;
    row.category = r.category;
    row.description = r.description;
    row.hasEvidence = r.hasEvidence;
    row.status = r.status;
    row.reviewedBy = r.reviewedBy ?? null;
    row.reviewedAt = r.reviewedAt ?? null;
    row.reviewNote = r.reviewNote ?? null;
    row.sanctionId = r.sanctionId ?? null;
    row.createdAt = r.createdAt;
    return row;
  }

  private reportToDomain(row: ReportOrmEntity): Report {
    return Report.restore({
      id: row.id,
      reporterId: row.reporterId,
      reporterDisplayName: row.reporterDisplayName,
      reportedUserId: row.reportedUserId,
      reportedDisplayName: row.reportedDisplayName,
      roomId: row.roomId ?? undefined,
      matchId: row.matchId ?? undefined,
      category: row.category,
      description: row.description,
      hasEvidence: row.hasEvidence,
      status: row.status,
      reviewedBy: row.reviewedBy ?? undefined,
      reviewedAt: row.reviewedAt ?? undefined,
      reviewNote: row.reviewNote ?? undefined,
      sanctionId: row.sanctionId ?? undefined,
      createdAt: row.createdAt,
    });
  }

  private sanctionToOrm(s: Sanction): SanctionOrmEntity {
    const row = new SanctionOrmEntity();
    row.id = s.id;
    row.userId = s.userId;
    row.userDisplayName = s.userDisplayName;
    row.type = s.type;
    row.reason = s.reason;
    row.amountCents = s.amountCents ?? null;
    row.suspendedUntil = s.suspendedUntil ?? null;
    row.reportId = s.reportId ?? null;
    row.appliedBy = s.appliedBy;
    row.appliedAt = s.appliedAt;
    row.revokedBy = s.revokedBy ?? null;
    row.revokedAt = s.revokedAt ?? null;
    row.revokeReason = s.revokeReason ?? null;
    return row;
  }

  private sanctionToDomain(row: SanctionOrmEntity): Sanction {
    return Sanction.restore({
      id: row.id,
      userId: row.userId,
      userDisplayName: row.userDisplayName,
      type: row.type,
      reason: row.reason,
      amountCents: row.amountCents ?? undefined,
      suspendedUntil: row.suspendedUntil ?? undefined,
      reportId: row.reportId ?? undefined,
      appliedBy: row.appliedBy,
      appliedAt: row.appliedAt,
      revokedBy: row.revokedBy ?? undefined,
      revokedAt: row.revokedAt ?? undefined,
      revokeReason: row.revokeReason ?? undefined,
    });
  }

  private disputeToOrm(d: Dispute): DisputeOrmEntity {
    const row = new DisputeOrmEntity();
    row.id = d.id;
    row.matchId = d.matchId;
    row.roomId = d.roomId;
    row.raisedBy = d.raisedBy;
    row.raisedByDisplayName = d.raisedByDisplayName;
    row.reason = d.reason;
    row.hasEvidence = d.hasEvidence;
    row.status = d.status;
    row.resolvedBy = d.resolvedBy ?? null;
    row.resolvedAt = d.resolvedAt ?? null;
    row.resolutionNote = d.resolutionNote ?? null;
    row.createdAt = d.createdAt;
    return row;
  }

  private disputeToDomain(row: DisputeOrmEntity): Dispute {
    return Dispute.restore({
      id: row.id,
      matchId: row.matchId,
      roomId: row.roomId,
      raisedBy: row.raisedBy,
      raisedByDisplayName: row.raisedByDisplayName,
      reason: row.reason,
      hasEvidence: row.hasEvidence,
      status: row.status,
      resolvedBy: row.resolvedBy ?? undefined,
      resolvedAt: row.resolvedAt ?? undefined,
      resolutionNote: row.resolutionNote ?? undefined,
      createdAt: row.createdAt,
    });
  }
}
