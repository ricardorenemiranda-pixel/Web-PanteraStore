import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { UserRole } from '../../../domain/entities/user.entity';

@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  steamId!: string | null;

  @Column({ type: 'varchar' })
  displayName!: string;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar' })
  role!: UserRole;

  @Column({ type: 'varchar', nullable: true })
  tradeUrl!: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  passwordHash!: string | null;
}
