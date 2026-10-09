import { BACKEND_URL } from "./config";
import { request } from "./adminApi";

// ------------------------------------------------------------------ tipos

export type ReportCategory = "toxic_chat" | "griefing" | "cheating" | "match_fixing" | "other";
export const REPORT_CATEGORIES: ReportCategory[] = ["toxic_chat", "griefing", "cheating", "match_fixing", "other"];
export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  toxic_chat: "Lenguaje tóxico",
  griefing: "Griefing / sabotaje",
  cheating: "Trampas",
  match_fixing: "Amañar el resultado",
  other: "Otro",
};

export type ReportStatus = "pending" | "resolved" | "dismissed";
export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "Pendiente",
  resolved: "Resuelto",
  dismissed: "Descartado",
};

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterDisplayName: string;
  reportedUserId: string;
  reportedDisplayName: string;
  roomId: string | null;
  matchId: string | null;
  category: ReportCategory;
  description: string;
  hasEvidence: boolean;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  sanctionId: string | null;
  createdAt: string;
}

export type SanctionType = "warning" | "fine" | "suspension";
export const SANCTION_TYPES: SanctionType[] = ["warning", "fine", "suspension"];
export const SANCTION_TYPE_LABEL: Record<SanctionType, string> = {
  warning: "Advertencia",
  fine: "Multa",
  suspension: "Suspensión",
};

export interface SanctionItem {
  id: string;
  userId: string;
  userDisplayName: string;
  type: SanctionType;
  reason: string;
  amountCents: number | null;
  suspendedUntil: string | null;
  reportId: string | null;
  appliedBy: string;
  appliedAt: string;
  revokedBy: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  isActive: boolean;
}

export type DisputeStatus = "pending" | "upheld" | "rejected";
export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  pending: "Pendiente",
  upheld: "Aceptada (revertida)",
  rejected: "Rechazada",
};

export interface DisputeItem {
  id: string;
  matchId: string;
  roomId: string;
  raisedBy: string;
  raisedByDisplayName: string;
  reason: string;
  hasEvidence: boolean;
  status: DisputeStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export interface DuplicateAccountGroup {
  key: string;
  kind: "login_ip" | "withdrawal_destination";
  userIds: string[];
  userDisplayNames: string[];
}

export interface CollusionPair {
  userIdA: string;
  userDisplayNameA: string;
  userIdB: string;
  userDisplayNameB: string;
  matchesTogether: number;
  sameTeamCount: number;
  bWinsWhenSameTeam: number;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuthGates {
  adultConfirmed: boolean;
  termsVersion: number;
  termsAccepted: boolean;
}

// ------------------------------------------------------------- mis salas

export function fetchAuthGates(): Promise<AuthGates> {
  return request<AuthGates>("/auth/me/gates");
}

export function acceptTerms(version: number) {
  return request("/auth/accept-terms", { method: "POST", body: JSON.stringify({ version }) });
}

export function fetchMySanctions(): Promise<{ sanctions: SanctionItem[]; activeSuspension: SanctionItem | null }> {
  return request("/sanctions/me");
}

async function postMultipart<T>(path: string, fields: Record<string, string>, file: File | null): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) form.append("evidence", file);
  const res = await fetch(`${BACKEND_URL}${path}`, { method: "POST", credentials: "include", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new Error(message ?? `No se pudo enviar (HTTP ${res.status}).`);
  }
  return res.json() as Promise<T>;
}

export function createReport(
  input: { reportedUserId: string; roomId?: string; matchId?: string; category: ReportCategory; description: string },
  evidence: File | null,
): Promise<ReportItem> {
  const fields: Record<string, string> = {
    reportedUserId: input.reportedUserId,
    category: input.category,
    description: input.description,
  };
  if (input.roomId) fields.roomId = input.roomId;
  if (input.matchId) fields.matchId = input.matchId;
  return postMultipart<ReportItem>("/reports", fields, evidence);
}

export function createDispute(
  input: { matchId: string; reason: string },
  evidence: File | null,
): Promise<DisputeItem> {
  return postMultipart<DisputeItem>("/disputes", { matchId: input.matchId, reason: input.reason }, evidence);
}

// -------------------------------------------------------------------- admin

export function fetchAdminReports(view: "pending" | "all" = "pending"): Promise<ReportItem[]> {
  return request<ReportItem[]>(`/admin/reports?view=${view}`);
}

export async function fetchReportEvidenceUrl(reportId: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/admin/reports/${reportId}/evidence`, { credentials: "include" });
  if (!res.ok) throw new Error("No se pudo cargar la evidencia.");
  return URL.createObjectURL(await res.blob());
}

export function resolveReport(id: string, note: string, sanctionId?: string): Promise<ReportItem> {
  return request(`/admin/reports/${id}/resolve`, { method: "POST", body: JSON.stringify({ note, sanctionId }) });
}

export function dismissReport(id: string, note: string): Promise<ReportItem> {
  return request(`/admin/reports/${id}/dismiss`, { method: "POST", body: JSON.stringify({ note }) });
}

export function applySanction(input: {
  userId: string;
  type: SanctionType;
  reason: string;
  amountCents?: number;
  suspendedUntil?: string;
  reportId?: string;
}): Promise<SanctionItem> {
  return request("/admin/sanctions", { method: "POST", body: JSON.stringify(input) });
}

export function revokeSanction(id: string, reason: string): Promise<SanctionItem> {
  return request(`/admin/sanctions/${id}/revoke`, { method: "POST", body: JSON.stringify({ reason }) });
}

export function fetchAdminSanctions(): Promise<SanctionItem[]> {
  return request<SanctionItem[]>("/admin/sanctions");
}

export function fetchAdminDisputes(view: "pending" | "all" = "pending"): Promise<DisputeItem[]> {
  return request<DisputeItem[]>(`/admin/disputes?view=${view}`);
}

export async function fetchDisputeEvidenceUrl(disputeId: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/admin/disputes/${disputeId}/evidence`, { credentials: "include" });
  if (!res.ok) throw new Error("No se pudo cargar la evidencia.");
  return URL.createObjectURL(await res.blob());
}

export function upholdDispute(id: string, note: string): Promise<DisputeItem> {
  return request(`/admin/disputes/${id}/uphold`, { method: "POST", body: JSON.stringify({ note }) });
}

export function rejectDispute(id: string, note: string): Promise<DisputeItem> {
  return request(`/admin/disputes/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) });
}

export function fetchDuplicateAccounts(): Promise<DuplicateAccountGroup[]> {
  return request<DuplicateAccountGroup[]>("/admin/fraud/duplicate-accounts");
}

export function fetchCollusion(): Promise<CollusionPair[]> {
  return request<CollusionPair[]>("/admin/fraud/collusion");
}

export function fetchAuditLog(filter: { actorId?: string; action?: string; limit?: number } = {}): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (filter.actorId) params.set("actorId", filter.actorId);
  if (filter.action) params.set("action", filter.action);
  if (filter.limit) params.set("limit", String(filter.limit));
  const qs = params.toString();
  return request<AuditLogEntry[]>(`/admin/audit${qs ? `?${qs}` : ""}`);
}
