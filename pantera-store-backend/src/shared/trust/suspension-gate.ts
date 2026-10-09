import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface ActiveSuspension {
  sanctionId: string;
  reason: string;
  suspendedUntil: Date | null;
}

/**
 * Consulta directa (SQL) a la tabla `sanctions`, deliberadamente SIN pasar
 * por el módulo `trust`: `rooms` necesita este chequeo para bloquear
 * crear/unirse a salas, y `trust` necesita repositorios de `rooms` para
 * corregir liquidaciones en disputas — importar `trust` desde `rooms` (o
 * viceversa) formaría un ciclo de módulos. Esta consulta vive en `shared`
 * (global) para que cualquier módulo la use sin crear esa dependencia.
 */
@Injectable()
export class SuspensionGate {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async activeSuspensionOf(userId: string): Promise<ActiveSuspension | null> {
    const rows = await this.dataSource.manager.query(
      `SELECT id, reason, "suspendedUntil"
         FROM sanctions
        WHERE "userId" = $1
          AND type = 'suspension'
          AND "revokedAt" IS NULL
          AND ("suspendedUntil" IS NULL OR "suspendedUntil" > now())
        ORDER BY "appliedAt" DESC
        LIMIT 1`,
      [userId],
    );
    if (rows.length === 0) return null;
    const row = rows[0] as { id: string; reason: string; suspendedUntil: Date | null };
    return { sanctionId: row.id, reason: row.reason, suspendedUntil: row.suspendedUntil };
  }
}
