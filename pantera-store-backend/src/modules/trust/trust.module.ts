import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { WalletModule } from '../wallet/wallet.module';
import {
  CreateDisputeUseCase,
  GetDisputeEvidenceUseCase,
  ListDisputesUseCase,
  ResolveDisputeUseCase,
} from './application/use-cases/dispute-use-cases';
import {
  CreateReportUseCase,
  GetReportEvidenceUseCase,
  ListReportsUseCase,
  ReviewReportUseCase,
} from './application/use-cases/report-use-cases';
import {
  ApplySanctionUseCase,
  IsUserSuspendedUseCase,
  ListSanctionsUseCase,
  RevokeSanctionUseCase,
} from './application/use-cases/sanction-use-cases';
import { TRUST_REPOSITORY } from './domain/ports/trust.repository.port';
import {
  DisputeEvidenceOrmEntity,
  DisputeOrmEntity,
  ReportEvidenceOrmEntity,
  ReportOrmEntity,
  SanctionOrmEntity,
} from './infrastructure/persistence/orm/trust.orm-entities';
import { TypeOrmTrustRepository } from './infrastructure/persistence/typeorm-trust.repository';
import { TrustController } from './interface/http/trust.controller';

@Module({
  imports: [
    AuthModule,
    WalletModule,
    // Solo para leer partidas y corregir liquidaciones cuando una disputa se acepta
    // (ver ReverseSettlementUseCase, exportado desde RoomsModule).
    RoomsModule,
    TypeOrmModule.forFeature([
      ReportOrmEntity,
      ReportEvidenceOrmEntity,
      SanctionOrmEntity,
      DisputeOrmEntity,
      DisputeEvidenceOrmEntity,
    ]),
  ],
  controllers: [TrustController],
  providers: [
    { provide: TRUST_REPOSITORY, useClass: TypeOrmTrustRepository },
    CreateReportUseCase,
    ListReportsUseCase,
    ReviewReportUseCase,
    GetReportEvidenceUseCase,
    ApplySanctionUseCase,
    RevokeSanctionUseCase,
    ListSanctionsUseCase,
    IsUserSuspendedUseCase,
    CreateDisputeUseCase,
    ListDisputesUseCase,
    ResolveDisputeUseCase,
    GetDisputeEvidenceUseCase,
  ],
})
export class TrustModule {}
