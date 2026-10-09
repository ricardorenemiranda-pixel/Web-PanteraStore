import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { ActivityKind } from '../../domain/activity-feed.port';

@Entity({ name: 'activity_feed' })
@Index(['createdAt'])
@Index(['kind', 'createdAt'])
export class ActivityFeedOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  kind!: ActivityKind;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', nullable: true })
  targetType!: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetId!: string | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
