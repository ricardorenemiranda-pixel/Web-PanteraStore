import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

export type DisputeStatus = 'pending' | 'upheld' | 'rejected';

export interface DisputeProps {
  id: string;
  matchId: string;
  roomId: string;
  raisedBy: string;
  raisedByDisplayName: string;
  reason: string;
  hasEvidence: boolean;
  status: DisputeStatus;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNote?: string;
  createdAt: Date;
}

export type CreateDisputeInput = Omit<
  DisputeProps,
  'status' | 'resolvedBy' | 'resolvedAt' | 'resolutionNote' | 'createdAt'
>;

/**
 * Un jugador impugna el resultado de SU partida. Si el admin la acepta
 * ("upheld"), se anula el resultado y se reembolsa a todos — nadie se queda
 * con el premio de una partida en disputa. No decide un ganador distinto:
 * eso evita adivinar quién ganó de verdad sin datos confiables.
 */
export class Dispute {
  private constructor(private readonly props: DisputeProps) {}

  static create(input: CreateDisputeInput): Dispute {
    if (input.reason.trim().length < 10) {
      throw new InvalidDomainStateException('Explica el motivo de la disputa (mínimo 10 letras).');
    }
    return new Dispute({ ...input, status: 'pending', createdAt: new Date() });
  }

  static restore(props: DisputeProps): Dispute {
    return new Dispute({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get matchId(): string {
    return this.props.matchId;
  }
  get roomId(): string {
    return this.props.roomId;
  }
  get raisedBy(): string {
    return this.props.raisedBy;
  }
  get raisedByDisplayName(): string {
    return this.props.raisedByDisplayName;
  }
  get reason(): string {
    return this.props.reason;
  }
  get hasEvidence(): boolean {
    return this.props.hasEvidence;
  }
  get status(): DisputeStatus {
    return this.props.status;
  }
  get resolvedBy(): string | undefined {
    return this.props.resolvedBy;
  }
  get resolvedAt(): Date | undefined {
    return this.props.resolvedAt;
  }
  get resolutionNote(): string | undefined {
    return this.props.resolutionNote;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  private resolve(status: 'upheld' | 'rejected', adminId: string, note: string): void {
    if (this.props.status !== 'pending') {
      throw new InvalidDomainStateException('Esta disputa ya fue resuelta.');
    }
    this.props.status = status;
    this.props.resolvedBy = adminId;
    this.props.resolvedAt = new Date();
    this.props.resolutionNote = note.trim() || undefined;
  }

  uphold(adminId: string, note: string): void {
    this.resolve('upheld', adminId, note);
  }

  reject(adminId: string, note: string): void {
    this.resolve('rejected', adminId, note);
  }
}
