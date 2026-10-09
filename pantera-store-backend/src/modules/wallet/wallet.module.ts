import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  CreditTestBalanceUseCase,
  LookupWalletUserUseCase,
} from './application/use-cases/admin-test-balance.use-cases';
import {
  GetPlatformWalletUseCase,
  GetWalletUseCase,
} from './application/use-cases/get-wallet.use-case';
import { AdjustWalletUseCase } from './application/use-cases/adjust-wallet.use-case';
import { GrantBonusUseCase } from './application/use-cases/grant-bonus.use-case';
import {
  CreditDepositUseCase,
  HoldWithdrawalUseCase,
  PayWithdrawalUseCase,
  ReleaseWithdrawalUseCase,
} from './application/use-cases/payment-operations.use-cases';
import {
  ChargeStakeUseCase,
  CollectPlatformFeeUseCase,
  LockStakeUseCase,
  PayPrizeUseCase,
  ReleaseStakeUseCase,
} from './application/use-cases/stake-operations.use-cases';
import { WALLET_REPOSITORY } from './domain/ports/wallet.repository.port';
import { LedgerImmutabilityGuard } from './infrastructure/persistence/ledger-immutability';
import { LedgerEntryOrmEntity } from './infrastructure/persistence/orm/ledger-entry.orm-entity';
import { WalletOrmEntity } from './infrastructure/persistence/orm/wallet.orm-entity';
import { TypeOrmWalletRepository } from './infrastructure/persistence/typeorm-wallet.repository';
import { WalletController } from './interface/http/wallet.controller';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([WalletOrmEntity, LedgerEntryOrmEntity]),
  ],
  controllers: [WalletController],
  providers: [
    LedgerImmutabilityGuard,
    { provide: WALLET_REPOSITORY, useClass: TypeOrmWalletRepository },
    GetWalletUseCase,
    LookupWalletUserUseCase,
    CreditTestBalanceUseCase,
    LockStakeUseCase,
    ReleaseStakeUseCase,
    ChargeStakeUseCase,
    PayPrizeUseCase,
    CollectPlatformFeeUseCase,
    GetPlatformWalletUseCase,
    CreditDepositUseCase,
    HoldWithdrawalUseCase,
    ReleaseWithdrawalUseCase,
    PayWithdrawalUseCase,
    AdjustWalletUseCase,
    GrantBonusUseCase,
  ],
  // Las operaciones de plata se exportan para que el futuro módulo de salas las use.
  exports: [
    GetWalletUseCase,
    CreditDepositUseCase,
    HoldWithdrawalUseCase,
    ReleaseWithdrawalUseCase,
    PayWithdrawalUseCase,
    AdjustWalletUseCase,
    CollectPlatformFeeUseCase,
    LockStakeUseCase,
    ReleaseStakeUseCase,
    ChargeStakeUseCase,
    PayPrizeUseCase,
  ],
})
export class WalletModule {}
