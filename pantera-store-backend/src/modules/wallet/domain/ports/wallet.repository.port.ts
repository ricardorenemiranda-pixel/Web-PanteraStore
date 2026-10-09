import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import type {
  LedgerEntry,
  NewLedgerEntry,
} from '../entities/ledger-entry.entity';
import type { Wallet, WalletKind } from '../entities/wallet.entity';

export const WALLET_REPOSITORY = Symbol('WALLET_REPOSITORY');

export interface AppendResult {
  entry: LedgerEntry;
  wallet: Wallet;
  /** true si la clave de idempotencia ya existía: no se movió plata otra vez. */
  replayed: boolean;
}

export interface ListEntriesOptions {
  limit?: number;
  /** Paginación: solo movimientos anteriores a esta fecha. */
  before?: Date;
}

export interface LedgerReconciliation {
  ok: boolean;
  /** Suma de los movimientos del libro. */
  ledgerAvailableCents: number;
  ledgerLockedCents: number;
  /** Lo que dice la billetera. */
  walletAvailableCents: number;
  walletLockedCents: number;
}

export interface WalletRepository {
  findById(id: string): Promise<Wallet | null>;
  findByUserId(userId: string): Promise<Wallet | null>;
  /**
   * Devuelve la billetera del usuario, creándola (saldo 0) si todavía no tiene.
   * Dentro de una transacción hay que pasar `tx`: pedir otra conexión mientras
   * la transacción tiene la suya puede agotar el pool y colgar todo.
   */
  getOrCreateForUser(
    userId: string,
    kind?: WalletKind,
    tx?: TransactionContext,
  ): Promise<Wallet>;
  /**
   * ÚNICA forma de mover plata: en una sola transacción bloquea la billetera,
   * valida, inserta el movimiento y actualiza los saldos. O pasa todo o nada.
   * Con `tx`, se une a una transacción ya abierta (ej. unirse a una sala:
   * bloquear la entrada y anotar al jugador salen juntos o no sale nada).
   */
  append(
    walletId: string,
    entry: NewLedgerEntry,
    tx?: TransactionContext,
  ): Promise<AppendResult>;
  listEntries(
    walletId: string,
    options?: ListEntriesOptions,
  ): Promise<LedgerEntry[]>;
  /** Verifica que el saldo guardado coincida con la suma del libro. */
  reconcile(walletId: string): Promise<LedgerReconciliation>;
}
