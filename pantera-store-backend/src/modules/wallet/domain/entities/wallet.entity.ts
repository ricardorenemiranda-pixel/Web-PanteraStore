import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import type { BalanceDelta } from './ledger-entry.entity';

/** "user": billetera de un jugador. "platform": la de la casa (comisiones). */
export type WalletKind = 'user' | 'platform';

export interface WalletProps {
  id: string;
  userId: string;
  kind: WalletKind;
  currency: 'PEN';
  /** Plata que el usuario puede usar o retirar. */
  availableCents: number;
  /** Plata comprometida en salas: no se puede gastar ni retirar. */
  lockedCents: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Los saldos guardados acá son un RESUMEN del libro (ledger): siempre deben
 * ser igual a la suma de los movimientos. Solo se modifican junto con un
 * movimiento, dentro de la misma transacción (ver el repositorio).
 */
export class Wallet {
  private constructor(private readonly props: WalletProps) {}

  static create(props: Pick<WalletProps, 'id' | 'userId' | 'kind'>): Wallet {
    const now = new Date();
    return new Wallet({
      ...props,
      currency: 'PEN',
      availableCents: 0,
      lockedCents: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: WalletProps): Wallet {
    return new Wallet({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get kind(): WalletKind {
    return this.props.kind;
  }
  get currency(): 'PEN' {
    return this.props.currency;
  }
  get availableCents(): number {
    return this.props.availableCents;
  }
  get lockedCents(): number {
    return this.props.lockedCents;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Aplica el efecto de un movimiento. Ninguna caja puede quedar en negativo. */
  applyDelta(delta: BalanceDelta): void {
    const available = this.props.availableCents + delta.availableCents;
    const locked = this.props.lockedCents + delta.lockedCents;
    if (available < 0) {
      throw new InvalidDomainStateException(
        'Saldo disponible insuficiente para esta operación.',
      );
    }
    if (locked < 0) {
      throw new InvalidDomainStateException(
        'No hay tanto saldo bloqueado para liberar o cobrar.',
      );
    }
    this.props.availableCents = available;
    this.props.lockedCents = locked;
    this.props.updatedAt = new Date();
  }
}
