import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import type { ActivityFeed, ActivityFeedEntry, ActivityFeedItem } from '../domain/activity-feed.port';
import { ActivityFeedOrmEntity } from './orm/activity-feed.orm-entity';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class TypeOrmActivityFeed implements ActivityFeed {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async record(entry: ActivityFeedEntry): Promise<void> {
    const row = new ActivityFeedOrmEntity();
    row.id = randomUUID();
    row.kind = entry.kind;
    row.message = entry.message;
    row.targetType = entry.targetType ?? null;
    row.targetId = entry.targetId ?? null;
    row.createdAt = new Date();
    await this.dataSource.manager.save(ActivityFeedOrmEntity, row);
  }

  async list(limit?: number): Promise<ActivityFeedItem[]> {
    const rows = await this.dataSource.manager.find(ActivityFeedOrmEntity, {
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      message: r.message,
      targetType: r.targetType ?? undefined,
      targetId: r.targetId ?? undefined,
      createdAt: r.createdAt,
    }));
  }
}
