import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { DepositStatus } from '../../../domain/entities/deposit-request.entity';
import type { PaymentMethod } from '../../../domain/entities/payment-limits';
import type { WithdrawalStatus } from '../../../domain/entities/withdrawal-request.entity';
import type { AlertKind } from '../../../domain/ports/payments.repository.port';

// Un comprobante = una recarga viva: el mismo número de operación no se puede
// usar en dos pedidos pendientes o aprobados (los rechazados o cancelados sí se pueden reintentar).
@Entity({ name: 'deposit_requests' })
@Index('uq_deposit_active_operation', ['method', 'operationCode'], {
  unique: true,
  where: `"status" IN ('pending', 'approved')`,
})
@Index(['userId', 'createdAt'])
@Index(['status', 'createdAt'])
export class DepositRequestOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  userDisplayName!: string;

  @Column({ type: 'int' })
  amountCents!: number;

  @Column({ type: 'varchar' })
  method!: PaymentMethod;

  @Column({ type: 'varchar' })
  operationCode!: string;

  @Column({ type: 'varchar' })
  proofContentType!: string;

  @Column({ type: 'varchar' })
  status!: DepositStatus;

  @Column({ type: 'jsonb' })
  riskFlags!: string[];

  @Column({ type: 'varchar', nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  reviewNote!: string | null;

  @Column({ type: 'int', nullable: true })
  creditedCents!: number | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}

/** La imagen del comprobante va aparte para que listar pedidos nunca cargue archivos pesados. */
@Entity({ name: 'deposit_proofs' })
export class DepositProofOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  depositId!: string;

  @Column({ type: 'varchar' })
  contentType!: string;

  @Column({ type: 'bytea' })
  data!: Buffer;
}

@Entity({ name: 'withdrawal_requests' })
@Index(['userId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['destination'])
export class WithdrawalRequestOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  userDisplayName!: string;

  @Column({ type: 'int' })
  amountCents!: number;

  @Column({ type: 'varchar' })
  method!: PaymentMethod;

  @Column({ type: 'varchar' })
  destination!: string;

  @Column({ type: 'varchar' })
  holderName!: string;

  @Column({ type: 'varchar' })
  status!: WithdrawalStatus;

  @Column({ type: 'jsonb' })
  riskFlags!: string[];

  @Column({ type: 'varchar', nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  reviewNote!: string | null;

  @Column({ type: 'varchar', nullable: true })
  payoutReference!: string | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'payment_alerts' })
@Index(['resolvedAt'])
export class PaymentAlertOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  kind!: AlertKind;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  refId!: string | null;

  @Column({ type: 'varchar' })
  message!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  resolvedBy!: string | null;
}
