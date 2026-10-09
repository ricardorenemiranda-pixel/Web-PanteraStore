import { request } from "./adminApi";
import { formatPEN } from "./currency";

export type LedgerEntryType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "STAKE_LOCK"
  | "STAKE_RELEASE"
  | "STAKE_CHARGE"
  | "PRIZE"
  | "PLATFORM_FEE"
  | "WITHDRAWAL_HOLD"
  | "WITHDRAWAL_RELEASE"
  | "WITHDRAWAL_PAID"
  | "ADJUSTMENT";

export interface Wallet {
  id: string;
  currency: string;
  availableCents: number;
  lockedCents: number;
}

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  availableDeltaCents: number;
  lockedDeltaCents: number;
  availableAfterCents: number;
  lockedAfterCents: number;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
  /** Solo en la vista de admin. */
  createdBy?: string;
}

export interface WalletView {
  wallet: Wallet;
  entries: LedgerEntry[];
}

export interface WalletUser {
  id: string;
  displayName: string;
  steamId: string | null;
  email: string | null;
}

export interface AdminWalletView extends WalletView {
  user: WalletUser;
}

/** El backend maneja céntimos enteros; en pantalla se muestran como soles. */
export function centsToPEN(cents: number): string {
  return formatPEN(cents / 100);
}

/** Con signo explícito, para movimientos: "+S/ 10.00" / "-S/ 10.00". */
export function signedCentsToPEN(cents: number): string {
  if (cents === 0) return "—";
  return `${cents > 0 ? "+" : "-"}${centsToPEN(Math.abs(cents))}`;
}

export const ENTRY_TYPE_LABEL: Record<LedgerEntryType, string> = {
  DEPOSIT: "Recarga",
  WITHDRAWAL: "Retiro",
  STAKE_LOCK: "Entrada bloqueada",
  STAKE_RELEASE: "Entrada devuelta",
  STAKE_CHARGE: "Entrada cobrada",
  PRIZE: "Premio",
  PLATFORM_FEE: "Comisión de sala",
  WITHDRAWAL_HOLD: "Retiro solicitado",
  WITHDRAWAL_RELEASE: "Retiro devuelto",
  WITHDRAWAL_PAID: "Retiro pagado",
  ADJUSTMENT: "Ajuste",
};

export function fetchMyWallet(limit = 50): Promise<WalletView> {
  return request<WalletView>(`/wallet/me?limit=${limit}`);
}

/** La caja de la plataforma (comisiones cobradas). Solo admin. */
export function fetchPlatformWallet(): Promise<WalletView> {
  return request<WalletView>("/wallet/admin/platform?limit=50");
}

export function lookupWalletUser(query: string): Promise<AdminWalletView> {
  return request<AdminWalletView>(`/wallet/admin/lookup?q=${encodeURIComponent(query)}`);
}

export interface CreditTestBalanceInput {
  userQuery: string;
  amountCents: number;
  reason: string;
  requestId: string;
}

export function creditTestBalance(
  input: CreditTestBalanceInput,
): Promise<{ user: WalletUser; wallet: Wallet; entry: LedgerEntry; replayed: boolean }> {
  return request("/wallet/admin/test-credit", { method: "POST", body: JSON.stringify(input) });
}

export interface GrantBonusInput {
  userQuery: string;
  amountCents: number;
  reason: string;
  requestId: string;
}

/** Bono REAL (a diferencia de test-credit): queda anunciado en el feed público de Comunidad. */
export function grantBonus(
  input: GrantBonusInput,
): Promise<{ user: WalletUser; wallet: Wallet; entry: LedgerEntry; replayed: boolean }> {
  return request("/wallet/admin/bonus", { method: "POST", body: JSON.stringify(input) });
}
