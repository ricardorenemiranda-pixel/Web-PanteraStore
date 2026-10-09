import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { ActivityFeedItem } from '../../../../../shared/activity/domain/activity-feed.port';

export class ActivityFeedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ActivityFeedItemDto {
  id!: string;
  kind!: string;
  message!: string;
  createdAt!: string;

  static fromDomain(item: ActivityFeedItem): ActivityFeedItemDto {
    return { id: item.id, kind: item.kind, message: item.message, createdAt: item.createdAt.toISOString() };
  }
}
