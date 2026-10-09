import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { PAYMENT_METHODS, type PaymentMethod } from './payment-limits';

export type DepositStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface DepositRequestProps {
  id: string;
  userId: string;
  userDisplayName: string;
  amountCents: number;
  method: PaymentMethod;
  /** Número de operación que aparece en el comprobante (Yape/Plin/banco). */
  operationCode: string;
  proofContentType: string;
  status: DepositStatus;
  /** Señales de riesgo detectadas al crear el pedido (ver risk.ts). */
  riskFlags: string[];
  reviewedBy?: string;
  reviewedAt?: Date;
  /** Motivo del rechazo o nota de la aprobación. */
  reviewNote?: string;
  /** Lo que realmente se acreditó (puede diferir del pedido si el comprobante decía otro monto). */
  creditedCents?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateDepositInput = Omit<
  DepositRequestProps,
  | 'status'
  | 'reviewedBy'
  | 'reviewedAt'
  | 'reviewNote'
  | 'creditedCents'
  | 'createdAt'
  | 'updatedAt'
>;

const OPERATION_CODE = /^[A-Za-z0-9-]{4,40}$/;

/**
 * Un pedido de recarga: el usuario dice cuánto pagó y por dónde, sube el
 * comprobante, y un administrador confirma que el dinero de verdad llegó. Solo
 * entonces se acredita el saldo (la acreditación la hace la billetera).
 */
export class DepositRequest {
  private constructor(private readonly props: DepositRequestProps) {}

  static create(input: CreateDepositInput): DepositRequest {
    if (!PAYMENT_METHODS.includes(input.method)) {
      throw new InvalidDomainStateException('Método de pago no válido.');
    }
    const code = input.operationCode.trim();
    if (!OPERATION_CODE.test(code)) {
      throw new InvalidDomainStateException(
        'El número de operación debe tener entre 4 y 40 letras, números o guiones.',
      );
    }
    const now = new Date();
    return new DepositRequest({
      ...input,
      operationCode: code.toUpperCase(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: DepositRequestProps): DepositRequest {
    return new DepositRequest({ ...props, riskFlags: [...props.riskFlags] });
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
  get amountCents(): number {
    return this.props.amountCents;
  }
  get method(): PaymentMethod {
    return this.props.method;
  }
  get operationCode(): string {
    return this.props.operationCode;
  }
  get proofContentType(): string {
    return this.props.proofContentType;
  }
  get status(): DepositStatus {
    return this.props.status;
  }
  get riskFlags(): string[] {
    return [...this.props.riskFlags];
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
  get creditedCents(): number | undefined {
    return this.props.creditedCents;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Aprueba: el admin confirmó que llegó el dinero. Si el comprobante mostraba
   * un monto distinto al pedido, se acredita lo que realmente llegó (y la nota
   * es obligatoria para que quede registrado por qué).
   */
  approve(adminId: string, creditedCents?: number, note?: string): void {
    this.ensurePending();
    const credited = creditedCents ?? this.props.amountCents;
    if (!Number.isSafeInteger(credited) || credited <= 0) {
      throw new InvalidDomainStateException(
        'El monto a acreditar debe ser positivo.',
      );
    }
    if (credited !== this.props.amountCents && !note?.trim()) {
      throw new InvalidDomainStateException(
        'Si acreditas un monto distinto al pedido, explica el motivo en la nota.',
      );
    }
    this.props.status = 'approved';
    this.props.creditedCents = credited;
    this.props.reviewedBy = adminId;
    this.props.reviewedAt = new Date();
    this.props.reviewNote = note?.trim() || undefined;
    this.touch();
  }

  reject(adminId: string, reason: string): void {
    this.ensurePending();
    if (reason.trim().length < 3) {
      throw new InvalidDomainStateException('Escribe el motivo del rechazo.');
    }
    this.props.status = 'rejected';
    this.props.reviewedBy = adminId;
    this.props.reviewedAt = new Date();
    this.props.reviewNote = reason.trim();
    this.touch();
  }

  /** El propio usuario retira su pedido antes de que se revise. */
  cancel(userId: string): void {
    this.ensurePending();
    if (userId !== this.props.userId) {
      throw new InvalidDomainStateException(
        'Solo quien hizo el pedido puede cancelarlo.',
      );
    }
    this.props.status = 'cancelled';
    this.touch();
  }

  private ensurePending(): void {
    if (this.props.status !== 'pending') {
      throw new InvalidDomainStateException(
        'Este pedido ya fue revisado y no se puede modificar.',
      );
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
