import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import type { User } from '../../../../auth/domain/entities/user.entity';
import type {
  LedgerEntry,
  LedgerEntryType,
} from '../../../domain/entities/ledger-entry.entity';
import type { Wallet } from '../../../domain/entities/wallet.entity';
import { MAX_TEST_CREDIT_CENTS } from '../../../application/use-cases/admin-test-balance.use-cases';
import { MAX_BONUS_CENTS } from '../../../application/use-cases/grant-bonus.use-case';

export class ListEntriesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  /** Paginación: solo movimientos anteriores a esta fecha (ISO). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  before?: Date;
}

export class LookupUserQueryDto {
  @IsString()
  @Length(1, 200)
  q!: string;
}

export class CreditTestBalanceDto {
  @IsString()
  @Length(1, 200)
  userQuery!: string;

  /** En céntimos enteros (S/ 10.00 = 1000). */
  @IsInt()
  @Min(1)
  @Max(MAX_TEST_CREDIT_CENTS)
  amountCents!: number;

  @IsString()
  @Length(3, 200)
  reason!: string;

  @IsString()
  @Length(8, 80)
  requestId!: string;
}

export class GrantBonusDto {
  @IsString()
  @Length(1, 200)
  userQuery!: string;

  /** En céntimos enteros (S/ 10.00 = 1000). */
  @IsInt()
  @Min(1)
  @Max(MAX_BONUS_CENTS)
  amountCents!: number;

  @IsString()
  @Length(3, 200)
  reason!: string;

  @IsString()
  @Length(8, 80)
  requestId!: string;
}

export class WalletResponseDto {
  id!: string;
  currency!: string;
  availableCents!: number;
  lockedCents!: number;

  static fromDomain(wallet: Wallet): WalletResponseDto {
    return {
      id: wallet.id,
      currency: wallet.currency,
      availableCents: wallet.availableCents,
      lockedCents: wallet.lockedCents,
    };
  }
}

export class LedgerEntryResponseDto {
  id!: string;
  type!: LedgerEntryType;
  availableDeltaCents!: number;
  lockedDeltaCents!: number;
  availableAfterCents!: number;
  lockedAfterCents!: number;
  referenceType!: string | null;
  referenceId!: string | null;
  description!: string | null;
  createdAt!: string;
  /** Solo se incluye en la vista de admin. */
  createdBy?: string;

  static fromDomain(
    entry: LedgerEntry,
    includeAuthor = false,
  ): LedgerEntryResponseDto {
    return {
      id: entry.id,
      type: entry.type,
      availableDeltaCents: entry.availableDeltaCents,
      lockedDeltaCents: entry.lockedDeltaCents,
      availableAfterCents: entry.availableAfterCents,
      lockedAfterCents: entry.lockedAfterCents,
      referenceType: entry.referenceType ?? null,
      referenceId: entry.referenceId ?? null,
      description: entry.description ?? null,
      createdAt: entry.createdAt.toISOString(),
      ...(includeAuthor ? { createdBy: entry.createdBy } : {}),
    };
  }
}

export class WalletViewResponseDto {
  wallet!: WalletResponseDto;
  entries!: LedgerEntryResponseDto[];

  static fromDomain(
    view: { wallet: Wallet; entries: LedgerEntry[] },
    includeAuthor = false,
  ): WalletViewResponseDto {
    return {
      wallet: WalletResponseDto.fromDomain(view.wallet),
      entries: view.entries.map((e) =>
        LedgerEntryResponseDto.fromDomain(e, includeAuthor),
      ),
    };
  }
}

export class WalletUserResponseDto {
  id!: string;
  displayName!: string;
  steamId!: string | null;
  email!: string | null;

  static fromDomain(user: User): WalletUserResponseDto {
    return {
      id: user.id,
      displayName: user.displayName,
      steamId: user.steamId ?? null,
      email: user.email ?? null,
    };
  }
}
