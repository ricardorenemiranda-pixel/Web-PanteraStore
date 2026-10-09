import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'audit_logs' })
@Index(['actorId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['targetType', 'targetId'])
export class AuditLogOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  actorId!: string;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar', nullable: true })
  targetType!: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
