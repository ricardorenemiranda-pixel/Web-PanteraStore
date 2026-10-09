import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

export type SanctionType = 'fine' | 'suspension' | 'warning';
export const SANCTION_TYPES: readonly SanctionType[] = ['fine', 'suspension', 'warning'];

export interface SanctionProps {
  id: string;
  userId: string;
  userDisplayName: string;
  type: SanctionType;
  reason: string;
  /** Solo 'fine': cuánto se le descontó. */
  amountCents?: number;
  /** Solo 'suspension': hasta cuándo. Ausente = indefinida (hasta que se revoque). */
  suspendedUntil?: Date;
  /** Reporte que originó la sanción, si vino de uno. */
  reportId?: string;
  appliedBy: string;
  appliedAt: Date;
  revokedBy?: string;
  revokedAt?: Date;
  revokeReason?: string;
}

export type CreateSanctionInput = Omit<
  SanctionProps,
  'appliedAt' | 'revokedBy' | 'revokedAt' | 'revokeReason'
>;

/**
 * Una multa, suspensión o advertencia aplicada a un usuario. No se borra
 * nunca (es historial): una sanción injusta se corrige revocándola, no
 * eliminándola, así el registro de qué pasó queda completo.
 */
export class Sanction {
  private constructor(private readonly props: SanctionProps) {}

  static create(input: CreateSanctionInput): Sanction {
    if (!SANCTION_TYPES.includes(input.type)) {
      throw new InvalidDomainStateException('Tipo de sanción no válido.');
    }
    if (input.reason.trim().length < 5) {
      throw new InvalidDomainStateException('Escribe el motivo de la sanción (mínimo 5 letras).');
    }
    if (input.type === 'fine') {
      if (!input.amountCents || !Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
        throw new InvalidDomainStateException('Una multa debe tener un monto positivo.');
      }
    }
    if (input.type === 'suspension' && input.suspendedUntil && input.suspendedUntil.getTime() <= Date.now()) {
      throw new InvalidDomainStateException('La fecha de fin de la suspensión debe ser en el futuro.');
    }
    return new Sanction({ ...input, appliedAt: new Date() });
  }

  static restore(props: SanctionProps): Sanction {
    return new Sanction({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get userDisplayName(): string {
    return this.props.userDisplayName;
  }
  get type(): SanctionType {
    return this.props.type;
  }
  get reason(): string {
    return this.props.reason;
  }
  get amountCents(): number | undefined {
    return this.props.amountCents;
  }
  get suspendedUntil(): Date | undefined {
    return this.props.suspendedUntil;
  }
  get reportId(): string | undefined {
    return this.props.reportId;
  }
  get appliedBy(): string {
    return this.props.appliedBy;
  }
  get appliedAt(): Date {
    return this.props.appliedAt;
  }
  get revokedBy(): string | undefined {
    return this.props.revokedBy;
  }
  get revokedAt(): Date | undefined {
    return this.props.revokedAt;
  }
  get revokeReason(): string | undefined {
    return this.props.revokeReason;
  }

  get isRevoked(): boolean {
    return this.props.revokedAt !== undefined;
  }

  /** ¿Esta suspensión sigue activa en `now`? Una multa o advertencia nunca está "activa" en este sentido. */
  isActiveSuspensionAt(now: Date): boolean {
    if (this.props.type !== 'suspension' || this.isRevoked) return false;
    return this.props.suspendedUntil === undefined || this.props.suspendedUntil.getTime() > now.getTime();
  }

  revoke(adminId: string, reason: string): void {
    if (this.isRevoked) {
      throw new InvalidDomainStateException('Esta sanción ya fue revocada.');
    }
    if (reason.trim().length < 3) {
      throw new InvalidDomainStateException('Escribe el motivo de la revocación.');
    }
    this.props.revokedBy = adminId;
    this.props.revokedAt = new Date();
    this.props.revokeReason = reason.trim();
  }
}
