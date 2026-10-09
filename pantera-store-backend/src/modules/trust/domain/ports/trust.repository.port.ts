import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import type { Dispute, DisputeStatus } from '../entities/dispute.entity';
import type { Report, ReportStatus } from '../entities/report.entity';
import type { Sanction, SanctionType } from '../entities/sanction.entity';

export const TRUST_REPOSITORY = Symbol('TRUST_REPOSITORY');

export interface EvidenceFile {
  contentType: string;
  data: Buffer;
}

export interface DuplicateAccountGroup {
  /** El valor compartido: una IP o un destino de retiro. */
  key: string;
  kind: 'login_ip' | 'withdrawal_destination';
  userIds: string[];
  userDisplayNames: string[];
}

export interface CollusionPair {
  userIdA: string;
  userDisplayNameA: string;
  userIdB: string;
  userDisplayNameB: string;
  matchesTogether: number;
  /** Veces que A y B quedaron en el mismo equipo. */
  sameTeamCount: number;
  /** De las veces que compartieron equipo, cuántas ganó B (posible "farming": A pierde a propósito para B). */
  bWinsWhenSameTeam: number;
}

export interface TrustRepository {
  // --- Reportes ---
  saveReport(report: Report, evidence: EvidenceFile | null, tx?: TransactionContext): Promise<void>;
  findReport(id: string, tx?: TransactionContext): Promise<Report | null>;
  findReportForUpdate(id: string, tx: TransactionContext): Promise<Report | null>;
  listReports(status?: ReportStatus, limit?: number): Promise<Report[]>;
  listReportsAbout(userId: string, limit?: number): Promise<Report[]>;
  getReportEvidence(reportId: string): Promise<EvidenceFile | null>;

  // --- Sanciones ---
  saveSanction(sanction: Sanction, tx?: TransactionContext): Promise<void>;
  findSanction(id: string, tx?: TransactionContext): Promise<Sanction | null>;
  findSanctionForUpdate(id: string, tx: TransactionContext): Promise<Sanction | null>;
  listSanctions(type?: SanctionType, limit?: number): Promise<Sanction[]>;
  listSanctionsOfUser(userId: string, limit?: number): Promise<Sanction[]>;
  /** La suspensión activa (no revocada, no vencida) del usuario, si tiene. */
  findActiveSuspension(userId: string, now: Date): Promise<Sanction | null>;

  // --- Disputas ---
  saveDispute(dispute: Dispute, tx?: TransactionContext): Promise<void>;
  findDispute(id: string, tx?: TransactionContext): Promise<Dispute | null>;
  findDisputeForUpdate(id: string, tx: TransactionContext): Promise<Dispute | null>;
  findDisputeByMatchId(matchId: string): Promise<Dispute | null>;
  listDisputes(status?: DisputeStatus, limit?: number): Promise<Dispute[]>;
  saveDisputeEvidence(disputeId: string, evidence: EvidenceFile): Promise<void>;
  getDisputeEvidence(disputeId: string): Promise<EvidenceFile | null>;

  // --- Antifraude ---
  findDuplicateAccountGroups(): Promise<DuplicateAccountGroup[]>;
  findCollusionCandidates(minMatchesTogether: number, minBWinRate: number): Promise<CollusionPair[]>;
}
