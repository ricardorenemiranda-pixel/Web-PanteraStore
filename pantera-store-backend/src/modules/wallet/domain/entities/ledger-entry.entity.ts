import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

/**
 * Todo el dinero se maneja en CÉNTIMOS enteros (S/ 11.50 = 1150), nunca en
 * decimales: con floats, 0.1 + 0.2 != 0.3 y el saldo se desfasa de a poco.
 */
export type LedgerEntryType =
  | 'DEPOSIT' // recarga: entra saldo disponible
  | 'WITHDRAWAL' // retiro: sale saldo disponible
  | 'STAKE_LOCK' // entrada a una sala: disponible -> bloqueado
  | 'STAKE_RELEASE' // sala cancelada / salida: bloqueado -> disponible
  | 'STAKE_CHARGE' // sala jugada: el bloqueado se consume
  | 'PRIZE' // premio: entra saldo disponible
  | 'PLATFORM_FEE' // comisión de una sala: entra a la billetera de la plataforma
  | 'WITHDRAWAL_HOLD' // pedido de retiro: disponible -> bloqueado (el dinero queda apartado)
  | 'WITHDRAWAL_RELEASE' // retiro rechazado o cancelado: bloqueado -> disponible
  | 'WITHDRAWAL_PAID' // retiro pagado: el bloqueado sale del sistema
  | 'ADJUSTMENT'; // corrección manual de un admin (siempre con motivo)

export type AdjustmentDirection = 'credit' | 'debit';

export interface BalanceDelta {
  availableCents: number;
  lockedCents: number;
}

/** Qué le hace cada tipo de movimiento a las dos "cajas" de la billetera. */
export function deltaFor(
  type: LedgerEntryType,
  amountCents: number,
  direction?: AdjustmentDirection,
): BalanceDelta {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new InvalidDomainStateException(
      'El monto debe ser un entero positivo de céntimos.',
    );
  }
  switch (type) {
    case 'DEPOSIT':
    case 'PRIZE':
    case 'PLATFORM_FEE':
      return { availableCents: amountCents, lockedCents: 0 };
    case 'WITHDRAWAL':
      return { availableCents: -amountCents, lockedCents: 0 };
    case 'STAKE_LOCK':
    case 'WITHDRAWAL_HOLD':
      return { availableCents: -amountCents, lockedCents: amountCents };
    case 'STAKE_RELEASE':
    case 'WITHDRAWAL_RELEASE':
      return { availableCents: amountCents, lockedCents: -amountCents };
    case 'STAKE_CHARGE':
    case 'WITHDRAWAL_PAID':
      return { availableCents: 0, lockedCents: -amountCents };
    case 'ADJUSTMENT':
      if (!direction) {
        throw new InvalidDomainStateException(
          'Un ajuste debe indicar si acredita o debita.',
        );
      }
      return {
        availableCents: direction === 'credit' ? amountCents : -amountCents,
        lockedCents: 0,
      };
  }
}

/** Lo que pide quien quiere registrar un movimiento (aún sin saldos resultantes). */
export interface NewLedgerEntry {
  type: LedgerEntryType;
  amountCents: number;
  /** Solo para ADJUSTMENT. */
  direction?: AdjustmentDirection;
  /** A qué se refiere: sala, retiro, recarga... (ej. "room" / "<id>"). */
  referenceType?: string;
  referenceId?: string;
  /**
   * Clave única por operación: si el mismo pedido llega dos veces (reintento,
   * doble clic), el segundo NO vuelve a mover plata — devuelve el primero.
   */
  idempotencyKey: string;
  description?: string;
  /** Quién lo originó: id de usuario, "system" o el id del admin. */
  createdBy: string;
}

export function validateNewEntry(entry: NewLedgerEntry): void {
  if (!entry.idempotencyKey.trim()) {
    throw new InvalidDomainStateException(
      'Todo movimiento necesita una clave de idempotencia.',
    );
  }
  if (!entry.createdBy.trim()) {
    throw new InvalidDomainStateException(
      'Todo movimiento debe registrar quién lo originó.',
    );
  }
  if (entry.type === 'ADJUSTMENT' && !entry.description?.trim()) {
    throw new InvalidDomainStateException(
      'Un ajuste manual debe llevar un motivo.',
    );
  }
}

export interface LedgerEntryProps {
  id: string;
  walletId: string;
  type: LedgerEntryType;
  availableDeltaCents: number;
  lockedDeltaCents: number;
  /** Saldos de la billetera justo después de este movimiento (foto para auditar). */
  availableAfterCents: number;
  lockedAfterCents: number;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
}

/**
 * Un movimiento del libro. Es INMUTABLE: no tiene métodos que lo cambien, y
 * además la base de datos rechaza cualquier UPDATE/DELETE sobre la tabla.
 * Un error se corrige con un movimiento nuevo (ADJUSTMENT), nunca editando.
 */
export class LedgerEntry {
  private constructor(private readonly props: Readonly<LedgerEntryProps>) {}

  static restore(props: LedgerEntryProps): LedgerEntry {
    return new LedgerEntry(props);
  }

  get id(): string {
    return this.props.id;
  }
  get walletId(): string {
    return this.props.walletId;
  }
  get type(): LedgerEntryType {
    return this.props.type;
  }
  get availableDeltaCents(): number {
    return this.props.availableDeltaCents;
  }
  get lockedDeltaCents(): number {
    return this.props.lockedDeltaCents;
  }
  get availableAfterCents(): number {
    return this.props.availableAfterCents;
  }
  get lockedAfterCents(): number {
    return this.props.lockedAfterCents;
  }
  get referenceType(): string | undefined {
    return this.props.referenceType;
  }
  get referenceId(): string | undefined {
    return this.props.referenceId;
  }
  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }
  get description(): string | undefined {
    return this.props.description;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
