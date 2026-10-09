export const ACTIVITY_FEED = Symbol('ACTIVITY_FEED');

export type ActivityKind = 'prize' | 'bonus' | 'sanction';

export interface ActivityFeedEntry {
  kind: ActivityKind;
  /** Texto ya listo para mostrar (sin datos sensibles: ver cada emisor). */
  message: string;
  targetType?: string;
  targetId?: string;
}

export interface ActivityFeedItem extends ActivityFeedEntry {
  id: string;
  createdAt: Date;
}

/**
 * Feed público de "qué está pasando": premios, bonos y sanciones. Es de
 * SOLO ESCRITURA desde el resto del dominio (como AuditLog) — nunca se edita
 * ni se borra. A diferencia de AuditLog, el mensaje ya viene armado por quien
 * lo emite, porque cada emisor decide qué es seguro mostrar públicamente
 * (ej. una sanción muestra el tipo pero NUNCA el motivo ni el monto).
 */
export interface ActivityFeed {
  record(entry: ActivityFeedEntry): Promise<void>;
  list(limit?: number): Promise<ActivityFeedItem[]>;
}
