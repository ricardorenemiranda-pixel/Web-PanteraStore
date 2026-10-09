import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { REPORT_CATEGORIES, type Report, type ReportCategory } from '../../../domain/entities/report.entity';
import { SANCTION_TYPES, type Sanction, type SanctionType } from '../../../domain/entities/sanction.entity';
import type { Dispute } from '../../../domain/entities/dispute.entity';

export class CreateReportDto {
  @IsString()
  reportedUserId!: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  matchId?: string;

  @IsIn(REPORT_CATEGORIES as readonly string[])
  category!: ReportCategory;

  @IsString()
  @Length(10, 2000)
  description!: string;
}

export class ReviewReportDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;

  @IsOptional()
  @IsString()
  sanctionId?: string;
}

export class ApplySanctionDto {
  @IsString()
  userId!: string;

  @IsIn(SANCTION_TYPES as readonly string[])
  type!: SanctionType;

  @IsString()
  @Length(5, 500)
  reason!: string;

  /** Solo 'fine', en céntimos. */
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  /** Solo 'suspension', ISO. Ausente = indefinida. */
  @IsOptional()
  @IsString()
  suspendedUntil?: string;

  @IsOptional()
  @IsString()
  reportId?: string;
}

export class RevokeSanctionDto {
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class CreateDisputeDto {
  @IsString()
  matchId!: string;

  @IsString()
  @Length(10, 2000)
  reason!: string;
}

export class ResolveDisputeDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}

export class ListQueryDto {
  @IsOptional()
  @IsIn(['pending', 'all'])
  view?: 'pending' | 'all';
}

export class ReportResponseDto {
  id!: string;
  reporterId!: string;
  reporterDisplayName!: string;
  reportedUserId!: string;
  reportedDisplayName!: string;
  roomId!: string | null;
  matchId!: string | null;
  category!: ReportCategory;
  description!: string;
  hasEvidence!: boolean;
  status!: string;
  reviewedBy!: string | null;
  reviewedAt!: string | null;
  reviewNote!: string | null;
  sanctionId!: string | null;
  createdAt!: string;

  static from(r: Report): ReportResponseDto {
    return {
      id: r.id,
      reporterId: r.reporterId,
      reporterDisplayName: r.reporterDisplayName,
      reportedUserId: r.reportedUserId,
      reportedDisplayName: r.reportedDisplayName,
      roomId: r.roomId ?? null,
      matchId: r.matchId ?? null,
      category: r.category,
      description: r.description,
      hasEvidence: r.hasEvidence,
      status: r.status,
      reviewedBy: r.reviewedBy ?? null,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewNote: r.reviewNote ?? null,
      sanctionId: r.sanctionId ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}

export class SanctionResponseDto {
  id!: string;
  userId!: string;
  userDisplayName!: string;
  type!: SanctionType;
  reason!: string;
  amountCents!: number | null;
  suspendedUntil!: string | null;
  reportId!: string | null;
  appliedBy!: string;
  appliedAt!: string;
  revokedBy!: string | null;
  revokedAt!: string | null;
  revokeReason!: string | null;
  isActive!: boolean;

  static from(s: Sanction, now = new Date()): SanctionResponseDto {
    return {
      id: s.id,
      userId: s.userId,
      userDisplayName: s.userDisplayName,
      type: s.type,
      reason: s.reason,
      amountCents: s.amountCents ?? null,
      suspendedUntil: s.suspendedUntil?.toISOString() ?? null,
      reportId: s.reportId ?? null,
      appliedBy: s.appliedBy,
      appliedAt: s.appliedAt.toISOString(),
      revokedBy: s.revokedBy ?? null,
      revokedAt: s.revokedAt?.toISOString() ?? null,
      revokeReason: s.revokeReason ?? null,
      isActive: s.isActiveSuspensionAt(now),
    };
  }
}

export class DisputeResponseDto {
  id!: string;
  matchId!: string;
  roomId!: string;
  raisedBy!: string;
  raisedByDisplayName!: string;
  reason!: string;
  hasEvidence!: boolean;
  status!: string;
  resolvedBy!: string | null;
  resolvedAt!: string | null;
  resolutionNote!: string | null;
  createdAt!: string;

  static from(d: Dispute): DisputeResponseDto {
    return {
      id: d.id,
      matchId: d.matchId,
      roomId: d.roomId,
      raisedBy: d.raisedBy,
      raisedByDisplayName: d.raisedByDisplayName,
      reason: d.reason,
      hasEvidence: d.hasEvidence,
      status: d.status,
      resolvedBy: d.resolvedBy ?? null,
      resolvedAt: d.resolvedAt?.toISOString() ?? null,
      resolutionNote: d.resolutionNote ?? null,
      createdAt: d.createdAt.toISOString(),
    };
  }
}

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
