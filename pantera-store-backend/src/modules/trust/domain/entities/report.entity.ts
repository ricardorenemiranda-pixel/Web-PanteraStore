import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

export type ReportCategory = 'toxic_chat' | 'griefing' | 'cheating' | 'match_fixing' | 'other';
export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  'toxic_chat',
  'griefing',
  'cheating',
  'match_fixing',
  'other',
];

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface ReportProps {
  id: string;
  reporterId: string;
  reporterDisplayName: string;
  reportedUserId: string;
  reportedDisplayName: string;
  /** La sala/partida donde ocurrió, si aplica. */
  roomId?: string;
  matchId?: string;
  category: ReportCategory;
  description: string;
  /** Imagen de evidencia (captura de chat, etc.), si el reportero subió una. */
  hasEvidence: boolean;
  status: ReportStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNote?: string;
  /** Si la revisión terminó en una sanción, cuál. */
  sanctionId?: string;
  createdAt: Date;
}

export type CreateReportInput = Omit<
  ReportProps,
  'status' | 'reviewedBy' | 'reviewedAt' | 'reviewNote' | 'sanctionId' | 'createdAt'
>;

/** Un reporte de un jugador sobre otro. No decide nada por sí solo: un admin lo revisa y, si corresponde, sanciona. */
export class Report {
  private constructor(private readonly props: ReportProps) {}

  static create(input: CreateReportInput): Report {
    if (input.reporterId === input.reportedUserId) {
      throw new InvalidDomainStateException('No puedes reportarte a ti mismo.');
    }
    if (!REPORT_CATEGORIES.includes(input.category)) {
      throw new InvalidDomainStateException('Categoría de reporte no válida.');
    }
    if (input.description.trim().length < 10) {
      throw new InvalidDomainStateException('Cuenta qué pasó con un poco más de detalle (mínimo 10 letras).');
    }
    return new Report({ ...input, status: 'pending', createdAt: new Date() });
  }

  static restore(props: ReportProps): Report {
    return new Report({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get reporterId(): string {
    return this.props.reporterId;
  }
  get reporterDisplayName(): string {
    return this.props.reporterDisplayName;
  }
  get reportedUserId(): string {
    return this.props.reportedUserId;
  }
  get reportedDisplayName(): string {
    return this.props.reportedDisplayName;
  }
  get roomId(): string | undefined {
    return this.props.roomId;
  }
  get matchId(): string | undefined {
    return this.props.matchId;
  }
  get category(): ReportCategory {
    return this.props.category;
  }
  get description(): string {
    return this.props.description;
  }
  get hasEvidence(): boolean {
    return this.props.hasEvidence;
  }
  get status(): ReportStatus {
    return this.props.status;
  }
  get reviewedBy(): string | undefined {
    return this.props.reviewedBy;
  }
  get reviewedAt(): Date | undefined {
    return this.props.reviewedAt;
  }
  get reviewNote(): string | undefined {
    return this.props.reviewNote;
  }
  get sanctionId(): string | undefined {
    return this.props.sanctionId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  private ensurePending(): void {
    if (this.props.status !== 'pending') {
      throw new InvalidDomainStateException('Este reporte ya fue revisado.');
    }
  }

  resolve(adminId: string, note: string, sanctionId?: string): void {
    this.ensurePending();
    this.props.status = 'resolved';
    this.props.reviewedBy = adminId;
    this.props.reviewedAt = new Date();
    this.props.reviewNote = note.trim() || undefined;
    this.props.sanctionId = sanctionId;
  }

  dismiss(adminId: string, note: string): void {
    this.ensurePending();
    this.props.status = 'dismissed';
    this.props.reviewedBy = adminId;
    this.props.reviewedAt = new Date();
    this.props.reviewNote = note.trim() || undefined;
  }
}
