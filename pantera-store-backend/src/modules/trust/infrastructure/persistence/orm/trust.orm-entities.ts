import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { DisputeStatus } from '../../../domain/entities/dispute.entity';
import type { ReportCategory, ReportStatus } from '../../../domain/entities/report.entity';
import type { SanctionType } from '../../../domain/entities/sanction.entity';

@Entity({ name: 'reports' })
@Index(['reportedUserId', 'createdAt'])
@Index(['status', 'createdAt'])
export class ReportOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  reporterId!: string;

  @Column({ type: 'varchar' })
  reporterDisplayName!: string;

  @Column({ type: 'varchar' })
  reportedUserId!: string;

  @Column({ type: 'varchar' })
  reportedDisplayName!: string;

  @Column({ type: 'varchar', nullable: true })
  roomId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  matchId!: string | null;

  @Column({ type: 'varchar' })
  category!: ReportCategory;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'boolean', default: false })
  hasEvidence!: boolean;

  @Column({ type: 'varchar' })
  status!: ReportStatus;

  @Column({ type: 'varchar', nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  reviewNote!: string | null;

  @Column({ type: 'varchar', nullable: true })
  sanctionId!: string | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}

/** La imagen de evidencia va aparte, igual que el comprobante de pago: listar reportes nunca carga archivos pesados. */
@Entity({ name: 'report_evidence' })
export class ReportEvidenceOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  reportId!: string;

  @Column({ type: 'varchar' })
  contentType!: string;

  @Column({ type: 'bytea' })
  data!: Buffer;
}

@Entity({ name: 'sanctions' })
@Index(['userId', 'appliedAt'])
@Index(['type', 'appliedAt'])
export class SanctionOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  userDisplayName!: string;

  @Column({ type: 'varchar' })
  type!: SanctionType;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'int', nullable: true })
  amountCents!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  suspendedUntil!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  reportId!: string | null;

  @Column({ type: 'varchar' })
  appliedBy!: string;

  @Column({ type: 'timestamptz' })
  appliedAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  revokedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  revokeReason!: string | null;
}

@Entity({ name: 'disputes' })
@Index('uq_dispute_match', ['matchId'], { unique: true })
@Index(['status', 'createdAt'])
export class DisputeOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  matchId!: string;

  @Column({ type: 'varchar' })
  roomId!: string;

  @Column({ type: 'varchar' })
  raisedBy!: string;

  @Column({ type: 'varchar' })
  raisedByDisplayName!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'boolean', default: false })
  hasEvidence!: boolean;

  @Column({ type: 'varchar' })
  status!: DisputeStatus;

  @Column({ type: 'varchar', nullable: true })
  resolvedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  resolutionNote!: string | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'dispute_evidence' })
export class DisputeEvidenceOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  disputeId!: string;

  @Column({ type: 'varchar' })
  contentType!: string;

  @Column({ type: 'bytea' })
  data!: Buffer;
}
