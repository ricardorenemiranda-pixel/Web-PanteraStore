import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type {
  RoomGame,
  RoomMode,
  RoomStatus,
} from '../../../domain/entities/room.entity';

@Entity({ name: 'rooms' })
@Index(['status', 'createdAt'])
export class RoomOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  game!: RoomGame;

  @Column({ type: 'varchar' })
  mode!: RoomMode;

  @Column({ type: 'int' })
  capacity!: number;

  @Column({ type: 'int' })
  entryFeeCents!: number;

  @Column({ type: 'int' })
  platformFeeCents!: number;

  @Column({ type: 'int' })
  prizePoolCents!: number;

  @Column({ type: 'varchar' })
  status!: RoomStatus;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @Column({ type: 'varchar' })
  createdByName!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
