import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import type { AuditEntry, AuditLog, AuditLogEntry, AuditLogFilter } from '../domain/audit-log.port';
import { AuditLogOrmEntity } from './orm/audit-log.orm-entity';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

@Injectable()
export class TypeOrmAuditLog implements AuditLog {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async record(entry: AuditEntry): Promise<void> {
    const row = new AuditLogOrmEntity();
    row.id = randomUUID();
    row.actorId = entry.actorId;
    row.action = entry.action;
    row.targetType = entry.targetType ?? null;
    row.targetId = entry.targetId ?? null;
    row.metadata = entry.metadata ?? null;
    row.createdAt = new Date();
    await this.dataSource.manager.save(AuditLogOrmEntity, row);
  }

  async list(filter: AuditLogFilter = {}): Promise<AuditLogEntry[]> {
    const qb = this.dataSource.manager.createQueryBuilder(AuditLogOrmEntity, 'a').orderBy('a.createdAt', 'DESC');
    if (filter.actorId) qb.andWhere('a."actorId" = :actorId', { actorId: filter.actorId });
    if (filter.action) qb.andWhere('a.action = :action', { action: filter.action });
    if (filter.targetType) qb.andWhere('a."targetType" = :targetType', { targetType: filter.targetType });
    if (filter.targetId) qb.andWhere('a."targetId" = :targetId', { targetId: filter.targetId });
    qb.take(Math.min(Math.max(filter.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT));
    const rows = await qb.getMany();
    return rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      action: r.action,
      targetType: r.targetType ?? undefined,
      targetId: r.targetId ?? undefined,
      metadata: r.metadata ?? undefined,
      createdAt: r.createdAt,
    }));
  }
}
