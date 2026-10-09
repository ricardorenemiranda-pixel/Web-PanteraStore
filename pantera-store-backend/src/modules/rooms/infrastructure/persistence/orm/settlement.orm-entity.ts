import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { SettlementPayout } from '../../../domain/entities/settlement.entity';

/** Una liquidación por partida (UNIQUE): imposible pagar dos veces la misma. */
@Entity({ name: 'settlements' })
export class SettlementOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  matchId!: string;

  @Index()
  @Column({ type: 'varchar' })
  roomId!: string;

  @Column({ type: 'int' })
  entryFeeCents!: number;

  @Column({ type: 'int' })
  playerCount!: number;

  @Column({ type: 'int' })
  prizePoolCents!: number;

  @Column({ type: 'int' })
  prizeEachCents!: number;

  @Column({ type: 'int' })
  platformCents!: number;

  @Column({ type: 'jsonb' })
  payouts!: SettlementPayout[];

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  reversedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reversedAt!: Date | null;
}
