import { BACKEND_URL } from "./config";
import { request } from "./adminApi";

export type PaymentMethod = "yape" | "plin" | "transfer";
export const PAYMENT_METHODS: PaymentMethod[] = ["yape", "plin", "transfer"];
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  yape: "Yape",
  plin: "Plin",
  transfer: "Transferencia",
};

export type DepositStatus = "pending" | "approved" | "rejected" | "cancelled";
export type WithdrawalStatus = "pending" | "paid" | "rejected" | "cancelled";

export interface KindLimits {
  minCents: number;
  maxCents: number;
  dailyMaxCents: number;
  maxPending: number;
}

export interface PaymentsConfig {
  enabled: boolean;
  limits: { deposit: KindLimits; withdrawal: KindLimits };
  instructions: { yape: string; plin: string; bank: string; holder: string };
}

export interface MyDeposit {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  operationCode: string;
  status: DepositStatus;
  creditedCents: number | null;
  note: string | null;
  createdAt: string;
}

export interface MyWithdrawal {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  destination: string;
  holderName: string;
  status: WithdrawalStatus;
  note: string | null;
  createdAt: string;
}

export interface AdminDeposit {
  id: string;
  userId: string;
  userDisplayName: string;
  amountCents: number;
  method: PaymentMethod;
  operationCode: string;
  status: DepositStatus;
  riskFlags: string[];
  creditedCents: number | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface AdminWithdrawal {
  id: string;
  userId: string;
  userDisplayName: string;
  amountCents: number;
  method: PaymentMethod;
  destination: string;
  holderName: string;
  status: WithdrawalStatus;
  riskFlags: string[];
  payoutReference: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface Treasury {
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
    playersCents: number;
    playersAvailableCents: number;
    playersLockedCents: number;
    platformCents: number;
  };
  adjustmentsNetCents: number;
  discrepancyCents: number;
}

export interface AlertItem {
  id: string;
  kind: string;
  severity: "high" | "medium";
  message: string;
  userId?: string;
  refId?: string;
  at: string;
  resolvable: boolean;
}

export const RISK_LABEL: Record<string, string> = {
  high_amount: "Monto cercano al máximo",
  many_requests: "Muchos pedidos seguidos",
  repeated_rejections: "Varios rechazos recientes",
  withdraw_without_play: "Retira dinero que casi no jugó",
  recent_deposit: "Retiro poco después de recargar",
  shared_destination: "Destino usado por otras cuentas",
};

export const DEPOSIT_STATUS_LABEL: Record<DepositStatus, string> = {
  pending: "En revisión",
  approved: "Acreditada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

export const WITHDRAWAL_STATUS_LABEL: Record<WithdrawalStatus, string> = {
  pending: "En revisión",
  paid: "Pagado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

// ------------------------------------------------------------------ jugador

export function fetchPaymentsConfig(): Promise<PaymentsConfig> {
  return request<PaymentsConfig>("/payments/config");
}

export function fetchMyPayments(): Promise<{ deposits: MyDeposit[]; withdrawals: MyWithdrawal[] }> {
  return request("/payments/me");
}

/** La recarga lleva un archivo (el comprobante), así que va como formulario y no como JSON. */
export async function createDeposit(
  input: { amountCents: number; method: PaymentMethod; operationCode: string },
  proof: File,
): Promise<MyDeposit> {
  const form = new FormData();
  form.append("amountCents", String(input.amountCents));
  form.append("method", input.method);
  form.append("operationCode", input.operationCode);
  form.append("proof", proof);
  const res = await fetch(`${BACKEND_URL}/payments/deposits`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new Error(message ?? `No se pudo enviar la recarga (HTTP ${res.status}).`);
  }
  return res.json() as Promise<MyDeposit>;
}

export function cancelDeposit(id: string): Promise<MyDeposit> {
  return request(`/payments/deposits/${id}/cancel`, { method: "POST" });
}

export function createWithdrawal(input: {
  amountCents: number;
  method: PaymentMethod;
  destination: string;
  holderName: string;
}): Promise<MyWithdrawal> {
  return request("/payments/withdrawals", { method: "POST", body: JSON.stringify(input) });
}

export function cancelWithdrawal(id: string): Promise<MyWithdrawal> {
  return request(`/payments/withdrawals/${id}/cancel`, { method: "POST" });
}

export function confirmAdult(birthDate: string): Promise<unknown> {
  return request("/auth/confirm-adult", { method: "POST", body: JSON.stringify({ birthDate }) });
}

// -------------------------------------------------------------------- admin

export function fetchAdminRequests(view: "pending" | "all" = "pending"): Promise<{
  deposits: AdminDeposit[];
  withdrawals: AdminWithdrawal[];
}> {
  return request(`/payments/admin/requests?view=${view}`);
}

/** El comprobante se pide con la sesión del admin y se muestra como imagen local (nunca por un enlace público). */
export async function fetchProofObjectUrl(depositId: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/payments/admin/deposits/${depositId}/proof`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("No se pudo cargar el comprobante.");
  return URL.createObjectURL(await res.blob());
}

export function approveDeposit(id: string, body: { creditedCents?: number; note?: string } = {}) {
  return request<AdminDeposit>(`/payments/admin/deposits/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function rejectDeposit(id: string, reason: string) {
  return request<AdminDeposit>(`/payments/admin/deposits/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function payWithdrawal(id: string, payoutReference: string) {
  return request<AdminWithdrawal>(`/payments/admin/withdrawals/${id}/pay`, {
    method: "POST",
    body: JSON.stringify({ payoutReference }),
  });
}

export function rejectWithdrawal(id: string, reason: string) {
  return request<AdminWithdrawal>(`/payments/admin/withdrawals/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function fetchTreasury(): Promise<Treasury> {
  return request<Treasury>("/payments/admin/treasury");
}

export function fetchAlerts(): Promise<AlertItem[]> {
  return request<AlertItem[]>("/payments/admin/alerts");
}

export function resolveAlert(id: string): Promise<{ ok: true }> {
  return request(`/payments/admin/alerts/${id}/resolve`, { method: "POST" });
}
