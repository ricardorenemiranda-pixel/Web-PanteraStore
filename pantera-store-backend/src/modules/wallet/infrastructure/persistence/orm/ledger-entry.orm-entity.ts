import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { LedgerEntryType } from '../../../domain/entities/ledger-entry.entity';
import { centsTransformer } from './wallet.orm-entity';

// Tabla de solo escritura: un trigger de Postgres rechaza UPDATE y DELETE
// (ver ledger-immutability.ts).
@Entity({ name: 'wallet_ledger_entries' })
@Index(['walletId', 'createdAt'])
@Index(['referenceType', 'referenceId'])
export class LedgerEntryOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  walletId!: string;

  @Column({ type: 'varchar' })
  type!: LedgerEntryType;

  @Column({ type: 'bigint', transformer: centsTransformer })
  availableDeltaCents!: number;

  @Column({ type: 'bigint', transformer: centsTransformer })
  lockedDeltaCents!: number;

  @Column({ type: 'bigint', transformer: centsTransformer })
  availableAfterCents!: number;

  @Column({ type: 'bigint', transformer: centsTransformer })
  lockedAfterCents!: number;

  @Column({ type: 'varchar', nullable: true })
  referenceType!: string | null;

  @Column({ type: 'varchar', nullable: true })
  referenceId!: string | null;

  @Column({ type: 'varchar', unique: true })
  idempotencyKey!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
