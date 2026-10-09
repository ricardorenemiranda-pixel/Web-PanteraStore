import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import {
  ApproveDepositUseCase,
  CancelDepositUseCase,
  CancelWithdrawalUseCase,
  GetAlertsUseCase,
  GetDepositProofUseCase,
  GetPaymentsConfigUseCase,
  GetTreasuryUseCase,
  ListMyPaymentsUseCase,
  ListPaymentsForAdminUseCase,
  MarkWithdrawalPaidUseCase,
  PaymentsPolicy,
  RejectDepositUseCase,
  RejectWithdrawalUseCase,
  RequestDepositUseCase,
  RequestWithdrawalUseCase,
  ResolveAlertUseCase,
} from './application/use-cases/payment-use-cases';
import { PAYMENTS_REPOSITORY } from './domain/ports/payments.repository.port';
import {
  DepositProofOrmEntity,
  DepositRequestOrmEntity,
  PaymentAlertOrmEntity,
  WithdrawalRequestOrmEntity,
} from './infrastructure/persistence/orm/payments.orm-entities';
import { TypeOrmPaymentsRepository } from './infrastructure/persistence/typeorm-payments.repository';
import { PaymentsController } from './interface/http/payments.controller';

@Module({
  imports: [
    AuthModule,
    WalletModule,
    TypeOrmModule.forFeature([
      DepositRequestOrmEntity,
      DepositProofOrmEntity,
      WithdrawalRequestOrmEntity,
      PaymentAlertOrmEntity,
    ]),
  ],
  controllers: [PaymentsController],
  providers: [
    { provide: PAYMENTS_REPOSITORY, useClass: TypeOrmPaymentsRepository },
    PaymentsPolicy,
    GetPaymentsConfigUseCase,
    ListMyPaymentsUseCase,
    ListPaymentsForAdminUseCase,
    RequestDepositUseCase,
    CancelDepositUseCase,
    ApproveDepositUseCase,
    RejectDepositUseCase,
    RequestWithdrawalUseCase,
    CancelWithdrawalUseCase,
    MarkWithdrawalPaidUseCase,
    RejectWithdrawalUseCase,
    GetDepositProofUseCase,
    GetTreasuryUseCase,
    GetAlertsUseCase,
    ResolveAlertUseCase,
  ],
})
export class PaymentsModule {}
