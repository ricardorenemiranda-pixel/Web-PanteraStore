import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { PAYMENT_METHODS, type PaymentMethod } from './payment-limits';

export type WithdrawalStatus = 'pending' | 'paid' | 'rejected' | 'cancelled';

export interface WithdrawalRequestProps {
  id: string;
  userId: string;
  userDisplayName: string;
  amountCents: number;
  method: PaymentMethod;
  /** Dónde pagarle: celular de Yape/Plin, o CCI/cuenta bancaria. */
  destination: string;
  /** Titular de la cuenta de destino. */
  holderName: string;
  status: WithdrawalStatus;
  riskFlags: string[];
  reviewedBy?: string;
  reviewedAt?: Date;
  /** Motivo del rechazo. */
  reviewNote?: string;
  /** Número de operación de la transferencia que hizo el admin al pagar. */
  payoutReference?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWithdrawalInput = Omit<
  WithdrawalRequestProps,
  | 'status'
  | 'reviewedBy'
  | 'reviewedAt'
  | 'reviewNote'
  | 'payoutReference'
  | 'createdAt'
  | 'updatedAt'
>;

const PHONE = /^9\d{8}$/;
const ACCOUNT = /^\d{10,24}$/;

/**
 * Un pedido de retiro. El dinero se aparta apenas se pide (queda "bloqueado")
 * para que no se pueda gastar mientras el admin revisa; el admin lo paga por
 * fuera (Yape, Plin o transferencia) y lo marca como pagado, o lo rechaza y el
 * dinero vuelve a estar disponible.
 */
export class WithdrawalRequest {
  private constructor(private readonly props: WithdrawalRequestProps) {}

  static create(input: CreateWithdrawalInput): WithdrawalRequest {
    if (!PAYMENT_METHODS.includes(input.method)) {
      throw new InvalidDomainStateException('Método de pago no válido.');
    }
    const destination = input.destination.replace(/[\s-]/g, '');
    if (
      input.method === 'transfer'
        ? !ACCOUNT.test(destination)
        : !PHONE.test(destination)
    ) {
      throw new InvalidDomainStateException(
        input.method === 'transfer'
          ? 'La cuenta o CCI debe tener entre 10 y 24 dígitos.'
          : 'El celular debe tener 9 dígitos y empezar con 9.',
      );
    }
    const holder = input.holderName.trim();
    if (holder.length < 3 || holder.length > 80) {
      throw new InvalidDomainStateException(
        'Escribe el nombre completo del titular de la cuenta.',
      );
    }
    const now = new Date();
    return new WithdrawalRequest({
      ...input,
      destination,
      holderName: holder,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: WithdrawalRequestProps): WithdrawalRequest {
    return new WithdrawalRequest({ ...props, riskFlags: [...props.riskFlags] });
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
  get destination(): string {
    return this.props.destination;
  }
  get holderName(): string {
    return this.props.holderName;
  }
  get status(): WithdrawalStatus {
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
  get payoutReference(): string | undefined {
    return this.props.payoutReference;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Anota las señales de riesgo detectadas al crear el pedido (antes de guardarlo). */
  setRiskFlags(flags: string[]): void {
    this.ensurePending();
    this.props.riskFlags = [...flags];
  }

  /** El admin ya pagó: guarda el número de operación de su transferencia. */
  markPaid(adminId: string, payoutReference: string): void {
    this.ensurePending();
    const ref = payoutReference.trim();
    if (ref.length < 4) {
      throw new InvalidDomainStateException(
        'Escribe el número de operación del pago que hiciste.',
      );
    }
    this.props.status = 'paid';
    this.props.reviewedBy = adminId;
    this.props.reviewedAt = new Date();
    this.props.payoutReference = ref;
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
