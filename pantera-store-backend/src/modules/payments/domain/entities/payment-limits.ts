import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

export type PaymentMethod = 'yape' | 'plin' | 'transfer';
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'yape',
  'plin',
  'transfer',
];

export type PaymentKind = 'deposit' | 'withdrawal';

export interface KindLimits {
  /** Mínimo y máximo por operación, en céntimos. */
  minCents: number;
  maxCents: number;
  /** Tope de lo pedido en las últimas 24 horas (cuenta también lo pendiente). */
  dailyMaxCents: number;
  /** Cuántos pedidos pendientes puede tener a la vez. */
  maxPending: number;
}

export interface PaymentLimits {
  deposit: KindLimits;
  withdrawal: KindLimits;
}

const label = (kind: PaymentKind) =>
  kind === 'deposit' ? 'recarga' : 'retiro';

const soles = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

/** Valida el monto de UNA operación contra los límites (mínimo y máximo). */
export function checkAmount(
  kind: PaymentKind,
  amountCents: number,
  limits: PaymentLimits,
): void {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new InvalidDomainStateException(
      'El monto debe ser un número positivo.',
    );
  }
  const l = limits[kind];
  if (amountCents < l.minCents) {
    throw new InvalidDomainStateException(
      `El monto mínimo de una ${label(kind)} es ${soles(l.minCents)}.`,
    );
  }
  if (amountCents > l.maxCents) {
    throw new InvalidDomainStateException(
      `El monto máximo de una ${label(kind)} es ${soles(l.maxCents)}.`,
    );
  }
}

/** Valida contra el tope diario: `alreadyCents` es lo ya pedido en las últimas 24 h. */
export function checkDaily(
  kind: PaymentKind,
  amountCents: number,
  alreadyCents: number,
  limits: PaymentLimits,
): void {
  const l = limits[kind];
  if (alreadyCents + amountCents > l.dailyMaxCents) {
    const left = Math.max(l.dailyMaxCents - alreadyCents, 0);
    throw new InvalidDomainStateException(
      `Superas el límite diario de ${label(kind)}s (${soles(l.dailyMaxCents)}). Hoy todavía puedes ${label(kind)} hasta ${soles(left)}.`,
    );
  }
}

export function checkPendingCount(
  kind: PaymentKind,
  pendingCount: number,
  limits: PaymentLimits,
): void {
  if (pendingCount >= limits[kind].maxPending) {
    throw new InvalidDomainStateException(
      `Ya tienes ${pendingCount} ${label(kind)}${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}. Espera a que se revisen antes de pedir otra.`,
    );
  }
}
