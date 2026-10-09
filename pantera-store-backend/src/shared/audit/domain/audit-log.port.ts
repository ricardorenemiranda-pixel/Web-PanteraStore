export const AUDIT_LOG = Symbol('AUDIT_LOG');

export interface AuditEntry {
  actorId: string;
  /** "modulo.accion", ej. "payments.deposit.approve", "rooms.match.void". */
  action: string;
  targetType?: string;
  targetId?: string;
  /** Detalle libre para reconstruir qué pasó (montos, motivos, etc.) — nunca contraseñas ni secretos. */
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntry extends AuditEntry {
  id: string;
  createdAt: Date;
}

export interface AuditLogFilter {
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  limit?: number;
}

/**
 * Bitácora de solo escritura de toda acción de administración. Nunca se
 * edita ni se borra (igual que el libro de la billetera) — es lo primero
 * que se revisa ante una disputa o una sospecha de abuso.
 */
export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
  list(filter?: AuditLogFilter): Promise<AuditLogEntry[]>;
}
