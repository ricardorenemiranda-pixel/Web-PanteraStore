import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import type {
  DepositRequest,
  DepositStatus,
} from '../../../domain/entities/deposit-request.entity';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from '../../../domain/entities/payment-limits';
import type {
  WithdrawalRequest,
  WithdrawalStatus,
} from '../../../domain/entities/withdrawal-request.entity';

const METHODS = PAYMENT_METHODS as readonly string[];

/** Llega como formulario (multipart): los números vienen como texto, por eso el @Type. */
export class CreateDepositDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsIn(METHODS)
  method!: PaymentMethod;

  @IsString()
  @Length(4, 40)
  operationCode!: string;
}

export class CreateWithdrawalDto {
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsIn(METHODS)
  method!: PaymentMethod;

  @IsString()
  @Length(9, 40)
  destination!: string;

  @IsString()
  @Length(3, 80)
  holderName!: string;
}

export class ApproveDepositDto {
  /** Solo si lo que llegó es distinto a lo pedido. */
  @IsOptional()
  @IsInt()
  @Min(1)
  creditedCents?: number;

  @IsOptional()
  @IsString()
  @Length(3, 300)
  note?: string;
}

export class ReasonDto {
  @IsString()
  @Length(3, 300)
  reason!: string;
}

export class PayoutDto {
  @IsString()
  @Length(4, 60)
  payoutReference!: string;
}

export class AdminRequestsQueryDto {
  /** pending (por defecto) o all. */
  @IsOptional()
  @IsIn(['pending', 'all'])
  view?: 'pending' | 'all';
}

/** Lo que ve el jugador: nada de señales de riesgo ni datos internos de la revisión. */
export class MyDepositDto {
  id!: string;
  amountCents!: number;
  method!: PaymentMethod;
  operationCode!: string;
  status!: DepositStatus;
  creditedCents!: number | null;
  /** Motivo, si se rechazó. */
  note!: string | null;
  createdAt!: string;

  static from(d: DepositRequest): MyDepositDto {
    return {
      id: d.id,
      amountCents: d.amountCents,
      method: d.method,
      operationCode: d.operationCode,
      status: d.status,
      creditedCents: d.creditedCents ?? null,
      note: d.status === 'rejected' ? (d.reviewNote ?? null) : null,
      createdAt: d.createdAt.toISOString(),
    };
  }
}

export class MyWithdrawalDto {
  id!: string;
  amountCents!: number;
  method!: PaymentMethod;
  destination!: string;
  holderName!: string;
  status!: WithdrawalStatus;
  /** Motivo, si se rechazó. */
  note!: string | null;
  createdAt!: string;

  static from(w: WithdrawalRequest): MyWithdrawalDto {
    return {
      id: w.id,
      amountCents: w.amountCents,
      method: w.method,
      destination: w.destination,
      holderName: w.holderName,
      status: w.status,
      note: w.status === 'rejected' ? (w.reviewNote ?? null) : null,
      createdAt: w.createdAt.toISOString(),
    };
  }
}

export class AdminDepositDto {
  id!: string;
  userId!: string;
  userDisplayName!: string;
  amountCents!: number;
  method!: PaymentMethod;
  operationCode!: string;
  status!: DepositStatus;
  riskFlags!: string[];
  creditedCents!: number | null;
  reviewedBy!: string | null;
  reviewedAt!: string | null;
  reviewNote!: string | null;
  createdAt!: string;

  static from(d: DepositRequest): AdminDepositDto {
    return {
      id: d.id,
      userId: d.userId,
      userDisplayName: d.userDisplayName,
      amountCents: d.amountCents,
      method: d.method,
      operationCode: d.operationCode,
      status: d.status,
      riskFlags: d.riskFlags,
      creditedCents: d.creditedCents ?? null,
      reviewedBy: d.reviewedBy ?? null,
      reviewedAt: d.reviewedAt?.toISOString() ?? null,
      reviewNote: d.reviewNote ?? null,
      createdAt: d.createdAt.toISOString(),
    };
  }
}

export class AdminWithdrawalDto {
  id!: string;
  userId!: string;
  userDisplayName!: string;
  amountCents!: number;
  method!: PaymentMethod;
  destination!: string;
  holderName!: string;
  status!: WithdrawalStatus;
  riskFlags!: string[];
  payoutReference!: string | null;
  reviewedBy!: string | null;
  reviewedAt!: string | null;
  reviewNote!: string | null;
  createdAt!: string;

  static from(w: WithdrawalRequest): AdminWithdrawalDto {
    return {
      id: w.id,
      userId: w.userId,
      userDisplayName: w.userDisplayName,
      amountCents: w.amountCents,
      method: w.method,
      destination: w.destination,
      holderName: w.holderName,
      status: w.status,
      riskFlags: w.riskFlags,
      payoutReference: w.payoutReference ?? null,
      reviewedBy: w.reviewedBy ?? null,
      reviewedAt: w.reviewedAt?.toISOString() ?? null,
      reviewNote: w.reviewNote ?? null,
      createdAt: w.createdAt.toISOString(),
    };
  }
}
