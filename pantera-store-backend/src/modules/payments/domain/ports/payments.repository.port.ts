import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import type {
  DepositRequest,
  DepositStatus,
} from '../entities/deposit-request.entity';
import type {
  WithdrawalRequest,
  WithdrawalStatus,
} from '../entities/withdrawal-request.entity';

export const PAYMENTS_REPOSITORY = Symbol('PAYMENTS_REPOSITORY');

/** El mismo número de operación ya se usó en otro pedido vivo (anti-fraude: un comprobante = una recarga). */
export class DuplicateOperationCodeException extends InvalidDomainStateException {
  constructor() {
    super(
      'Ese número de operación ya fue registrado en otro pedido. Cada comprobante se puede usar una sola vez.',
    );
  }
}

export interface ProofFile {
  contentType: string;
  data: Buffer;
}

export type AlertKind = 'duplicate_operation_code' | 'wallet_out_of_sync';

export interface PaymentAlert {
  id: string;
  kind: AlertKind;
  userId?: string;
  refId?: string;
  message: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface LifetimeTotals {
  /** Total recargado (aprobado). */
  depositedCents: number;
  /** Total jugado en salas (entradas cobradas). */
  playedCents: number;
  lastDepositAt: Date | null;
}

export interface TreasurySnapshot {
  deposits: {
    approvedCents: number;
    approvedCount: number;
    pendingCents: number;
    pendingCount: number;
    rejectedCount: number;
    approvedLast24hCents: number;
  };
  withdrawals: {
    paidCents: number;
    paidCount: number;
    pendingCents: number;
    pendingCount: number;
    rejectedCount: number;
    paidLast24hCents: number;
  };
  wallets: {
    /** Lo que los jugadores tienen y la casa les debe (disponible + bloqueado). */
    playersCents: number;
    playersAvailableCents: number;
    playersLockedCents: number;
    /** Comisión acumulada de la plataforma. */
    platformCents: number;
  };
  /** Ajustes manuales y saldo de prueba: no es dinero real que haya entrado. */
  adjustmentsNetCents: number;
  /**
   * Debe ser 0: el dinero que hay en las billeteras (jugadores + plataforma)
   * tiene que ser igual a lo que entró (recargas + ajustes) menos lo que salió (retiros pagados).
   */
  discrepancyCents: number;
}

export interface WalletOutOfSync {
  walletId: string;
  userId: string;
  walletAvailableCents: number;
  walletLockedCents: number;
  ledgerAvailableCents: number;
  ledgerLockedCents: number;
}

export interface PaymentsRepository {
  /** Serializa los pedidos de UN usuario (para que los límites diarios no se puedan saltar pidiendo a la vez). */
  lockUser(userId: string, tx: TransactionContext): Promise<void>;

  // --- Recargas ---
  insertDeposit(
    deposit: DepositRequest,
    proof: ProofFile,
    tx: TransactionContext,
  ): Promise<void>;
  saveDeposit(deposit: DepositRequest, tx?: TransactionContext): Promise<void>;
  findDeposit(
    id: string,
    tx?: TransactionContext,
  ): Promise<DepositRequest | null>;
  findDepositForUpdate(
    id: string,
    tx: TransactionContext,
  ): Promise<DepositRequest | null>;
  listDepositsOfUser(userId: string, limit?: number): Promise<DepositRequest[]>;
  listDeposits(
    statuses?: readonly DepositStatus[],
    limit?: number,
  ): Promise<DepositRequest[]>;
  getProof(depositId: string): Promise<ProofFile | null>;
  /** Suma de lo pedido (pendiente + aprobado) desde `since`. */
  sumDepositsSince(
    userId: string,
    since: Date,
    tx: TransactionContext,
  ): Promise<number>;
  countDepositsSince(
    userId: string,
    since: Date,
    tx: TransactionContext,
  ): Promise<number>;
  countPendingDeposits(userId: string, tx: TransactionContext): Promise<number>;
  countRejectedDepositsSince(
    userId: string,
    since: Date,
    tx: TransactionContext,
  ): Promise<number>;

  // --- Retiros ---
  insertWithdrawal(
    withdrawal: WithdrawalRequest,
    tx: TransactionContext,
  ): Promise<void>;
  saveWithdrawal(
    withdrawal: WithdrawalRequest,
    tx?: TransactionContext,
  ): Promise<void>;
  findWithdrawal(
    id: string,
    tx?: TransactionContext,
  ): Promise<WithdrawalRequest | null>;
  findWithdrawalForUpdate(
    id: string,
    tx: TransactionContext,
  ): Promise<WithdrawalRequest | null>;
  listWithdrawalsOfUser(
    userId: string,
    limit?: number,
  ): Promise<WithdrawalRequest[]>;
  listWithdrawals(
    statuses?: readonly WithdrawalStatus[],
    limit?: number,
  ): Promise<WithdrawalRequest[]>;
  /** Suma de lo pedido (pendiente + pagado) desde `since`. */
  sumWithdrawalsSince(
    userId: string,
    since: Date,
    tx: TransactionContext,
  ): Promise<number>;
  countWithdrawalsSince(
    userId: string,
    since: Date,
    tx: TransactionContext,
  ): Promise<number>;
  countPendingWithdrawals(
    userId: string,
    tx: TransactionContext,
  ): Promise<number>;
  /** Cuántas OTRAS cuentas pidieron pagos al mismo destino. */
  countOtherUsersWithDestination(
    userId: string,
    destination: string,
    tx: TransactionContext,
  ): Promise<number>;

  // --- Historial de la cuenta (para las señales de riesgo) ---
  lifetimeTotals(
    userId: string,
    tx: TransactionContext,
  ): Promise<LifetimeTotals>;

  // --- Alertas y tesorería ---
  saveAlert(alert: PaymentAlert): Promise<void>;
  listOpenAlerts(): Promise<PaymentAlert[]>;
  resolveAlert(id: string, adminId: string): Promise<boolean>;
  treasury(): Promise<TreasurySnapshot>;
  walletsOutOfSync(limit?: number): Promise<WalletOutOfSync[]>;
}
