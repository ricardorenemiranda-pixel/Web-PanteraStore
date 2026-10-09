import { Check, Column, Entity, PrimaryColumn } from 'typeorm';
import type { WalletKind } from '../../../domain/entities/wallet.entity';

/** Postgres devuelve bigint como string; los céntimos caben de sobra en un number. */
export const centsTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => Number(value),
};

@Entity({ name: 'wallets' })
@Check('"availableCents" >= 0 AND "lockedCents" >= 0')
export class WalletOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  // Una billetera por usuario (las de la casa usan un userId propio).
  @Column({ type: 'varchar', unique: true })
  userId!: string;

  @Column({ type: 'varchar' })
  kind!: WalletKind;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'bigint', transformer: centsTransformer })
  availableCents!: number;

  @Column({ type: 'bigint', transformer: centsTransformer })
  lockedCents!: number;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
