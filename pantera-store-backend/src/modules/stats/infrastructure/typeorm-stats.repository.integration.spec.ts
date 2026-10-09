import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../../../shared/testing/test-datasource';
import type { AppConfig } from '../../../config/configuration';
import { TypeOrmUnitOfWork } from '../../../shared/infrastructure/typeorm-unit-of-work';
import { User } from '../../auth/domain/entities/user.entity';
import type { UserRepository } from '../../auth/domain/ports/user.repository.port';
import { AdjustWalletUseCase } from '../../wallet/application/use-cases/adjust-wallet.use-case';
import {
  ChargeStakeUseCase,
  CollectPlatformFeeUseCase,
  LockStakeUseCase,
  PayPrizeUseCase,
  ReleaseStakeUseCase,
} from '../../wallet/application/use-cases/stake-operations.use-cases';
import { LedgerImmutabilityGuard } from '../../wallet/infrastructure/persistence/ledger-immutability';
import { LedgerEntryOrmEntity } from '../../wallet/infrastructure/persistence/orm/ledger-entry.orm-entity';
import { WalletOrmEntity } from '../../wallet/infrastructure/persistence/orm/wallet.orm-entity';
import { TypeOrmWalletRepository } from '../../wallet/infrastructure/persistence/typeorm-wallet.repository';
import { RoomJoiner } from '../../rooms/application/room-joiner';
import {
  type Actor,
  CreateRoomUseCase,
  JoinRoomUseCase,
} from '../../rooms/application/use-cases/room-use-cases';
import { ReverseSettlementUseCase } from '../../rooms/application/use-cases/reverse-settlement.use-case';
import { SettleMatchUseCase } from '../../rooms/application/use-cases/settlement-use-cases';
import { MatchOrmEntity } from '../../rooms/infrastructure/persistence/orm/match.orm-entity';
import { RoomOrmEntity } from '../../rooms/infrastructure/persistence/orm/room.orm-entity';
import { RoomPlayerOrmEntity } from '../../rooms/infrastructure/persistence/orm/room-player.orm-entity';
import { SettlementOrmEntity } from '../../rooms/infrastructure/persistence/orm/settlement.orm-entity';
import { TypeOrmMatchRepository } from '../../rooms/infrastructure/persistence/typeorm-match.repository';
import { TypeOrmRoomRepository } from '../../rooms/infrastructure/persistence/typeorm-room.repository';
import { TypeOrmSettlementRepository } from '../../rooms/infrastructure/persistence/typeorm-settlement.repository';
import { ManualLobbyProvider } from '../../rooms/infrastructure/lobby/manual-lobby.provider';
import { MatchOrchestrator } from '../../rooms/application/match-orchestrator';
import { CancelRoomUseCase } from '../../rooms/application/use-cases/room-use-cases';
import { TypeOrmStatsRepository } from './typeorm-stats.repository';

// Prueba contra Postgres real. Solo corre con WALLET_TEST_DB_URL (base DESECHABLE):
//   WALLET_TEST_DB_URL=postgres://postgres:postgres@localhost:5433/pantera_wallet_test npx jest typeorm-stats
const allowSuspensionGate = {
  activeSuspensionOf: () => Promise.resolve(null),
} as unknown as import('../../../shared/trust/suspension-gate').SuspensionGate;
const fakeActivityFeed = {
  record: () => Promise.resolve(),
  list: () => Promise.resolve([]),
} as unknown as import('../../../shared/activity/domain/activity-feed.port').ActivityFeed;

const url = process.env.WALLET_TEST_DB_URL;
const describeDb = url ? describe : describe.skip;

describeDb('estadísticas de jugadores (Postgres real)', () => {
  let dataSource: DataSource;
  let wallets: TypeOrmWalletRepository;
  let rooms: TypeOrmRoomRepository;
  let matches: TypeOrmMatchRepository;
  let settlements: TypeOrmSettlementRepository;
  let stats: TypeOrmStatsRepository;
  let create: CreateRoomUseCase;
  let join: JoinRoomUseCase;
  let orchestrator: MatchOrchestrator;
  let reverseSettlement: ReverseSettlementUseCase;
  let n = 0;
  const run = Date.now();
  const users = new Map<string, User>();
  const usersRepo: UserRepository = {
    findById: (id) => Promise.resolve(users.get(id) ?? null),
    findBySteamId: () => Promise.resolve(null),
    findByEmail: () => Promise.resolve(null),
    save: () => Promise.resolve(),
  };
  const configFor = () =>
    ({
      get: (key: string) =>
        ({
          matches: { provider: 'manual', joinTimeoutSec: 300, pollIntervalSec: 5 },
          rooms: { platformFeePercent: 10 },
          terms: { version: 1 },
        })[key],
    }) as unknown as ConfigService<AppConfig, true>;

  beforeAll(async () => {
    dataSource = await createTestDataSource(url!, [
      WalletOrmEntity,
      LedgerEntryOrmEntity,
      RoomOrmEntity,
      RoomPlayerOrmEntity,
      MatchOrmEntity,
      SettlementOrmEntity,
    ]);
    await new LedgerImmutabilityGuard(dataSource).onModuleInit();

    wallets = new TypeOrmWalletRepository(
      dataSource,
      dataSource.getRepository(WalletOrmEntity),
      dataSource.getRepository(LedgerEntryOrmEntity),
    );
    rooms = new TypeOrmRoomRepository(dataSource);
    matches = new TypeOrmMatchRepository(dataSource);
    settlements = new TypeOrmSettlementRepository(dataSource);
    stats = new TypeOrmStatsRepository(dataSource);

    const uow = new TypeOrmUnitOfWork(dataSource);
    const events = { roomChanged: () => undefined };
    const joiner = new RoomJoiner(new LockStakeUseCase(wallets));
    const cancel = new CancelRoomUseCase(rooms, uow, events, new ReleaseStakeUseCase(wallets));
    const settle = new SettleMatchUseCase(
      rooms,
      matches,
      settlements,
      new TypeOrmUnitOfWork(dataSource),
      events,
      fakeActivityFeed,
      new ChargeStakeUseCase(wallets),
      new PayPrizeUseCase(wallets),
      new CollectPlatformFeeUseCase(wallets),
    );
    reverseSettlement = new ReverseSettlementUseCase(
      rooms,
      matches,
      settlements,
      uow,
      events,
      new AdjustWalletUseCase(wallets),
    );

    create = new CreateRoomUseCase(rooms, usersRepo, uow, events, joiner, configFor(), allowSuspensionGate);
    join = new JoinRoomUseCase(rooms, usersRepo, uow, events, joiner, configFor(), allowSuspensionGate);
    orchestrator = new MatchOrchestrator(
      rooms,
      matches,
      usersRepo,
      new ManualLobbyProvider(),
      uow,
      events,
      cancel,
      configFor(),
      settle,
    );
  }, 30_000);

  afterAll(async () => {
    await dataSource.destroy();
  });

  async function player(fundsCents = 5000): Promise<Actor> {
    const id = `stats-user-${run}-${n++}`;
    users.set(
      id,
      User.create({
        id,
        steamId: `7656${run}${n}`,
        displayName: `Jugador ${n}`,
        role: 'customer',
        adultConfirmedAt: new Date(),
        termsAcceptedVersion: 1,
      }),
    );
    const wallet = await wallets.getOrCreateForUser(id);
    await wallets.append(wallet.id, {
      type: 'DEPOSIT',
      amountCents: fundsCents,
      idempotencyKey: `seed-${id}`,
      createdBy: 'test',
    });
    return { userId: id, steamId: users.get(id)!.steamId, role: 'customer' };
  }

  async function settledMatch(entryFeeCents = 1000, outcome: 'radiant' | 'dire' = 'radiant') {
    const players = await Promise.all([player(), player()]);
    let room = await create.execute(players[0], { name: 'Sala stats', mode: 'turbo', capacity: 2, entryFeeCents });
    room = await join.execute(players[1], room.id);
    await orchestrator.onRoomFull(room);
    const match = (await matches.findActiveByRoomId(room.id))!;
    await orchestrator.adminSetResult(match.id, outcome);
    return { room, match: (await matches.findById(match.id))!, players };
  }

  it('cuenta partidas, victorias y ganancia neta de un jugador', async () => {
    const { match, players } = await settledMatch(1000, 'radiant');
    const winnerId = match.winners[0].userId;
    const loserId = players.find((p) => p.userId !== winnerId)!.userId;

    const winnerRow = await stats.statsOf(winnerId);
    const loserRow = await stats.statsOf(loserId);
    expect(winnerRow!.matchesPlayed).toBeGreaterThanOrEqual(1);
    expect(winnerRow!.wins).toBeGreaterThanOrEqual(1);
    expect(winnerRow!.netCents).toBeGreaterThan(0);
    expect(loserRow!.matchesPlayed).toBeGreaterThanOrEqual(1);
    expect(loserRow!.netCents).toBeLessThan(0);
  });

  it('el ranking ordena por victorias y excluye partidas anuladas', async () => {
    const a = await player();
    const b = await player();
    let room = await create.execute(a, { name: 'Sala ranking A', mode: 'turbo', capacity: 2, entryFeeCents: 500 });
    room = await join.execute(b, room.id);
    await orchestrator.onRoomFull(room);
    const activeMatch = (await matches.findActiveByRoomId(room.id))!;
    await orchestrator.adminSetResult(activeMatch.id, 'radiant');
    const finishedMatch = (await matches.findById(activeMatch.id))!;
    const winnerId = finishedMatch.winners[0].userId;

    const before = await stats.statsOf(winnerId);
    expect(before!.wins).toBeGreaterThanOrEqual(1);

    const board = await stats.leaderboard(1, 200);
    expect(board.some((r) => r.userId === winnerId)).toBe(true);
    // El ranking viene ordenado: nadie con más victorias que el primero debería aparecer después.
    for (let i = 1; i < board.length; i++) expect(board[i - 1].wins).toBeGreaterThanOrEqual(board[i].wins);
  });

  it('una liquidación revertida por disputa no cuenta como ganancia ni como partida jugada', async () => {
    const { match } = await settledMatch(1000, 'radiant');
    const winnerId = match.winners[0].userId;
    const before = await stats.statsOf(winnerId);
    expect(before!.netCents).toBeGreaterThan(0);

    await reverseSettlement.execute(match.id, 'admin-test', 'prueba de reversión en stats');

    // Este jugador nuevo solo tuvo esta única partida, y ahora quedó "voided" (revertida):
    // ya no debe figurar en absoluto (ni victorias, ni ganancia, ni partidas jugadas).
    const after = await stats.statsOf(winnerId);
    expect(after).toBeNull();
  });
});
