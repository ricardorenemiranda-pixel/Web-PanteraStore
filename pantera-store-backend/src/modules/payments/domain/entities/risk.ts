import type { PaymentLimits } from './payment-limits';

/** Señales que se muestran al admin junto al pedido. Ninguna bloquea por sí sola: avisan para que la revisión sea atenta. */
export type RiskFlag =
  | 'high_amount' // monto cerca del máximo permitido
  | 'many_requests' // muchos pedidos en poco tiempo
  | 'repeated_rejections' // varios pedidos rechazados recientemente
  | 'withdraw_without_play' // quiere retirar dinero que casi no jugó
  | 'recent_deposit' // retira poco después de haber recargado
  | 'shared_destination'; // el mismo destino de pago lo usan otras cuentas

export const RISK_LABEL: Record<RiskFlag, string> = {
  high_amount: 'Monto cercano al máximo',
  many_requests: 'Muchos pedidos seguidos',
  repeated_rejections: 'Varios rechazos recientes',
  withdraw_without_play: 'Retira dinero que casi no jugó',
  recent_deposit: 'Retiro poco después de recargar',
  shared_destination: 'Destino usado por otras cuentas',
};

/** Con cuántos pedidos en la última hora se considera "seguidos". */
export const MANY_REQUESTS_PER_HOUR = 3;
export const REPEATED_REJECTIONS = 3;
/** Un retiro que llega a esta fracción del máximo se marca como monto alto. */
export const HIGH_AMOUNT_RATIO = 0.8;
/** Si jugó menos de esta fracción de lo que recargó, es "retirar sin jugar". */
export const MIN_PLAYED_RATIO = 0.5;
export const RECENT_DEPOSIT_HOURS = 24;

export interface DepositRiskContext {
  amountCents: number;
  limits: PaymentLimits;
  requestsLastHour: number;
  rejectedDepositsLast30d: number;
}

export function assessDepositRisk(ctx: DepositRiskContext): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (ctx.amountCents >= ctx.limits.deposit.maxCents * HIGH_AMOUNT_RATIO)
    flags.push('high_amount');
  if (ctx.requestsLastHour >= MANY_REQUESTS_PER_HOUR)
    flags.push('many_requests');
  if (ctx.rejectedDepositsLast30d >= REPEATED_REJECTIONS)
    flags.push('repeated_rejections');
  return flags;
}

export interface WithdrawalRiskContext {
  amountCents: number;
  limits: PaymentLimits;
  requestsLastHour: number;
  /** Total recargado (aprobado) en toda la vida de la cuenta. */
  totalDepositedCents: number;
  /** Total que ya jugó en salas (entradas cobradas) en toda la vida de la cuenta. */
  totalPlayedCents: number;
  /** Horas desde su última recarga aprobada (null si nunca recargó). */
  hoursSinceLastDeposit: number | null;
  /** Cuántas OTRAS cuentas usaron este mismo destino de pago. */
  otherUsersWithSameDestination: number;
}

export function assessWithdrawalRisk(ctx: WithdrawalRiskContext): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (ctx.amountCents >= ctx.limits.withdrawal.maxCents * HIGH_AMOUNT_RATIO)
    flags.push('high_amount');
  if (ctx.requestsLastHour >= MANY_REQUESTS_PER_HOUR)
    flags.push('many_requests');
  if (
    ctx.totalDepositedCents > 0 &&
    ctx.totalPlayedCents < ctx.totalDepositedCents * MIN_PLAYED_RATIO
  ) {
    flags.push('withdraw_without_play');
  }
  if (
    ctx.hoursSinceLastDeposit !== null &&
    ctx.hoursSinceLastDeposit < RECENT_DEPOSIT_HOURS
  ) {
    flags.push('recent_deposit');
  }
  if (ctx.otherUsersWithSameDestination > 0) flags.push('shared_destination');
  return flags;
}
