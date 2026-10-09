import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from '../../config/configuration';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { MatchOrchestrator } from './application/match-orchestrator';
import { RoomJoiner } from './application/room-joiner';
import {
  CancelRoomUseCase,
  CreateRoomUseCase,
  GetRoomUseCase,
  JoinRoomUseCase,
  LeaveRoomUseCase,
  ListRoomsUseCase,
} from './application/use-cases/room-use-cases';
import { LOBBY_PROVIDER } from './domain/ports/lobby-provider.port';
import { MATCH_REPOSITORY } from './domain/ports/match.repository.port';
import { SETTLEMENT_REPOSITORY } from './domain/ports/settlement.repository.port';
import { ROOM_EVENTS } from './domain/ports/room-events.port';
import { ROOM_REPOSITORY } from './domain/ports/room.repository.port';
import { FakeLobbyProvider } from './infrastructure/lobby/fake-lobby.provider';
import { ManualLobbyProvider } from './infrastructure/lobby/manual-lobby.provider';
import { MatchOrmEntity } from './infrastructure/persistence/orm/match.orm-entity';
import { SettlementOrmEntity } from './infrastructure/persistence/orm/settlement.orm-entity';
import { TypeOrmSettlementRepository } from './infrastructure/persistence/typeorm-settlement.repository';
import {
  ListMyMatchHistoryUseCase,
  SettleMatchUseCase,
  VoidMatchUseCase,
} from './application/use-cases/settlement-use-cases';
import { ReverseSettlementUseCase } from './application/use-cases/reverse-settlement.use-case';
import { RoomOrmEntity } from './infrastructure/persistence/orm/room.orm-entity';
import { RoomPlayerOrmEntity } from './infrastructure/persistence/orm/room-player.orm-entity';
import { TypeOrmMatchRepository } from './infrastructure/persistence/typeorm-match.repository';
import { TypeOrmRoomRepository } from './infrastructure/persistence/typeorm-room.repository';
import { MatchesController } from './interface/http/matches.controller';
import { RoomsController } from './interface/http/rooms.controller';
import { RoomsGateway } from './interface/ws/rooms.gateway';

@Module({
  imports: [
    AuthModule,
    WalletModule,
    TypeOrmModule.forFeature([
      RoomOrmEntity,
      RoomPlayerOrmEntity,
      MatchOrmEntity,
      SettlementOrmEntity,
    ]),
  ],
  controllers: [RoomsController, MatchesController],
  providers: [
    RoomsGateway,
    { provide: ROOM_EVENTS, useExisting: RoomsGateway },
    { provide: ROOM_REPOSITORY, useClass: TypeOrmRoomRepository },
    { provide: MATCH_REPOSITORY, useClass: TypeOrmMatchRepository },
    { provide: SETTLEMENT_REPOSITORY, useClass: TypeOrmSettlementRepository },
    SettleMatchUseCase,
    VoidMatchUseCase,
    ReverseSettlementUseCase,
    ListMyMatchHistoryUseCase,
    ManualLobbyProvider,
    FakeLobbyProvider,
    {
      // El "bot" que se use se decide por configuración (MATCH_PROVIDER).
      provide: LOBBY_PROVIDER,
      inject: [ConfigService, ManualLobbyProvider, FakeLobbyProvider],
      useFactory: (
        config: ConfigService<AppConfig, true>,
        manual: ManualLobbyProvider,
        fake: FakeLobbyProvider,
      ) => {
        const kind = config.get('matches', { infer: true }).provider;
        if (kind === 'steam') {
          throw new Error(
            'MATCH_PROVIDER=steam: el bot de Steam todavía no está implementado (ver src/modules/rooms/README.md). Usa "manual".',
          );
        }
        if (kind === 'fake') {
          if (config.get('nodeEnv', { infer: true }) === 'production') {
            throw new Error(
              'MATCH_PROVIDER=fake no se puede usar en producción.',
            );
          }
          return fake;
        }
        return manual;
      },
    },
    MatchOrchestrator,
    RoomJoiner,
    ListRoomsUseCase,
    GetRoomUseCase,
    CreateRoomUseCase,
    JoinRoomUseCase,
    LeaveRoomUseCase,
    CancelRoomUseCase,
  ],
  // Exportado para que `trust` (disputas) pueda corregir una liquidación
  // y consultar partidas, sin que `rooms` necesite importar `trust` (evita un ciclo).
  exports: [MATCH_REPOSITORY, ReverseSettlementUseCase],
})
export class RoomsModule {}
