import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../../../shared/testing/test-datasource';
import type { AppConfig } from '../../../config/configuration';
import { TypeOrmUnitOfWork } from '../../../shared/infrastructure/typeorm-unit-of-work';
import { User } from '../../auth/domain/entities/user.entity';
import type { UserRepository } from '../../auth/domain/ports/user.repository.port';
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
import type { Room } from '../domain/entities/room.entity';
import type {
  LobbyConfig,
  LobbyProvider,
} from '../domain/ports/lobby-provider.port';
import type { RoomEvents } from '../domain/ports/room-events.port';
import { FakeLobbyProvider } from '../infrastructure/lobby/fake-lobby.provider';
import { ManualLobbyProvider } from '../infrastructure/lobby/manual-lobby.provider';
import { MatchOrmEntity } from '../infrastructure/persistence/orm/match.orm-entity';
import { RoomOrmEntity } from '../infrastructure/persistence/orm/room.orm-entity';
import { SettlementOrmEntity } from '../infrastructure/persistence/orm/settlement.orm-entity';
import { TypeOrmSettlementRepository } from '../infrastructure/persistence/typeorm-settlement.repository';
import { RoomPlayerOrmEntity } from '../infrastructure/persistence/orm/room-player.orm-entity';
import { TypeOrmMatchRepository } from '../infrastructure/persistence/typeorm-match.repository';
import { TypeOrmRoomRepository } from '../infrastructure/persistence/typeorm-room.repository';
import { MatchOrchestrator } from './match-orchestrator';
import { RoomJoiner } from './room-joiner';
import { SettleMatchUseCase } from './use-cases/settlement-use-cases';
import {
  type Actor,
  CancelRoomUseCase,
  CreateRoomUseCase,
  GetRoomUseCase,
  JoinRoomUseCase,
  LeaveRoomUseCase,
} from './use-cases/room-use-cases';

// Prueba contra Postgres real. Solo corre con WALLET_TEST_DB_URL (base DESECHABLE):
//   WALLET_TEST_DB_URL=postgres://postgres:postgres@localhost:5433/pantera_wallet_test npx jest match-orchestrator
const allowSuspensionGate = {
  activeSuspensionOf: () => Promise.resolve(null),
} as unknown as import('../../../shared/trust/suspension-gate').SuspensionGate;
const fakeActivityFeed = {
  record: () => Promise.resolve(),
  list: () => Promise.resolve([]),
} as unknown as import('../../../shared/activity/domain/activity-feed.port').ActivityFeed;

const url = process.env.WALLET_TEST_DB_URL;
const describeDb = url ? describe : describe.skip;

describeDb('orquestador de partidas (Postgres real)', () => {
  let dataSource: DataSource;
  let wallets: TypeOrmWalletRepository;
  let rooms: TypeOrmRoomRepository;
  let matches: TypeOrmMatchRepository;
  let fake: FakeLobbyProvider;
  let create: CreateRoomUseCase;
  let join: JoinRoomUseCase;
  let leave: LeaveRoomUseCase;
  let cancel: CancelRoomUseCase;
  let get: GetRoomUseCase;
  let orchestrator: MatchOrchestrator;
  let n = 0;
  const run = Date.now();
  const users = new Map<string, User>();
  const usersRepo: UserRepository = {
    findById: (id) => Promise.resolve(users.get(id) ?? null),
    findBySteamId: () => Promise.resolve(null),
    findByEmail: () => Promise.resolve(null),
    save: () => Promise.resolve(),
  };
  const config = {
    get: (key: string) =>
      ({
        matches: { provider: 'fake', joinTimeoutSec: 300, pollIntervalSec: 5 },
        rooms: { platformFeePercent: 10 },
        terms: { version: 1 },
      })[key],
  } as unknown as ConfigService<AppConfig, true>;

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
    fake = new FakeLobbyProvider();
    const uow = new TypeOrmUnitOfWork(dataSource);
    const events: RoomEvents = { roomChanged: () => undefined };
    const release = new ReleaseStakeUseCase(wallets);
    const joiner = new RoomJoiner(new LockStakeUseCase(wallets));

    create = new CreateRoomUseCase(
      rooms,
      usersRepo,
      uow,
      events,
      joiner,
      config,
      allowSuspensionGate,
    );
    join = new JoinRoomUseCase(
      rooms,
      usersRepo,
      uow,
      events,
      joiner,
      config,
      allowSuspensionGate,
    );
    leave = new LeaveRoomUseCase(rooms, uow, events, release);
    cancel = new CancelRoomUseCase(rooms, uow, events, release);
    get = new GetRoomUseCase(rooms);
    orchestrator = buildOrchestrator(fake);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  function buildOrchestrator(provider: LobbyProvider): MatchOrchestrator {
    return new MatchOrchestrator(
      rooms,
      matches,
      usersRepo,
      provider,
      new TypeOrmUnitOfWork(dataSource),
      { roomChanged: () => undefined },
      cancel,
      config,
      new SettleMatchUseCase(
        rooms,
        matches,
        new TypeOrmSettlementRepository(dataSource),
        new TypeOrmUnitOfWork(dataSource),
        { roomChanged: () => undefined },
        fakeActivityFeed,
        new ChargeStakeUseCase(wallets),
        new PayPrizeUseCase(wallets),
        new CollectPlatformFeeUseCase(wallets),
      ),
    );
  }

  async function player(fundsCents = 5000): Promise<Actor> {
    const id = `mo-user-${run}-${n++}`;
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

  const balances = async (userId: string) => {
    const w = (await wallets.findByUserId(userId))!;
    return [w.availableCents, w.lockedCents];
  };
  const steamOf = (a: Actor) => a.steamId!;

  /** Una sala de 2 jugadores ya llena. */
  async function fullRoom(): Promise<{ room: Room; a: Actor; b: Actor }> {
    const [a, b] = [await player(), await player()];
    const room = await create.execute(a, {
      name: 'Sala de partida',
      mode: 'captains_mode',
      capacity: 2,
      entryFeeCents: 1100,
    });
    const full = await join.execute(b, room.id);
    return { room: full, a, b };
  }

  it('modo manual: sala llena -> "jugando" sin lobby; el admin decide el ganador una sola vez', async () => {
    const manual = buildOrchestrator(new ManualLobbyProvider());
    const { room } = await fullRoom();
    await manual.onRoomFull(room);

    expect((await get.execute(room.id)).status).toBe('playing');
    const match = (await matches.findByRoomId(room.id))!;
    expect(match.status).toBe('in_game');
    expect(match.lobbyName).toBeUndefined();

    const done = await manual.adminSetResult(match.id, 'radiant');
    expect(done.status).toBe('finished');
    expect(done.resultSource).toBe('admin');
    expect(done.winners).toHaveLength(1);
    await expect(manual.adminSetResult(match.id, 'dire')).rejects.toThrow(
      'ya tiene un resultado',
    );
  });

  it('una sala jugando ya no permite salir ni cancelar', async () => {
    const manual = buildOrchestrator(new ManualLobbyProvider());
    const { room, a, b } = await fullRoom();
    await manual.onRoomFull(room);
    await expect(leave.execute(b, room.id)).rejects.toThrow('ya empezó');
    await expect(cancel.execute(a, room.id)).rejects.toThrow(
      'todavía no empezó',
    );
  });

  it('flujo completo con bot: abre lobby, espera a todos, lanza y lee al ganador', async () => {
    const { room, a, b } = await fullRoom();
    await orchestrator.onRoomFull(room);

    let match = (await matches.findActiveByRoomId(room.id))!;
    expect(match.status).toBe('waiting_players');
    expect(match.lobbyName).toMatch(/^Pantera /);
    expect(match.lobbyPassword).toMatch(/^[A-Z2-9]{6}$/);
    expect(match.participants.map((p) => p.team).sort()).toEqual([
      'dire',
      'radiant',
    ]);
    const ref = { id: match.lobbyRef! };
    expect((await get.execute(room.id)).status).toBe('full');

    // Entra uno solo: sigue esperando.
    fake.simulateJoin(ref, steamOf(a));
    await orchestrator.tick([room.id]);
    match = (await matches.findById(match.id))!;
    expect(match.status).toBe('waiting_players');
    expect(match.presentSteamIds).toEqual([steamOf(a)]);

    // Entra el segundo: se lanza y la sala pasa a "jugando".
    fake.simulateJoin(ref, steamOf(b));
    await orchestrator.tick([room.id]);
    match = (await matches.findById(match.id))!;
    expect(match.status).toBe('in_game');
    expect((await get.execute(room.id)).status).toBe('playing');

    // Termina la partida: el bot confirma al ganador.
    const dire = match.participants.find((p) => p.team === 'dire')!;
    fake.simulateAbandon(ref, dire.steamId);
    fake.simulateFinish(ref, 'dire', '7777');
    await orchestrator.tick([room.id]);
    match = (await matches.findById(match.id))!;
    expect(match.status).toBe('finished');
    expect(match.outcome).toBe('dire');
    expect(match.resultSource).toBe('bot');
    expect(match.dotaMatchId).toBe('7777');
    expect(match.winners.map((p) => p.userId)).toEqual([dire.userId]);
    expect(match.abandonedUserIds).toEqual([dire.userId]);
  });

  it('expulsa a quien no es de la sala y no lo cuenta', async () => {
    const { room, a } = await fullRoom();
    await orchestrator.onRoomFull(room);
    const match = (await matches.findActiveByRoomId(room.id))!;
    const ref = { id: match.lobbyRef! };

    fake.simulateJoin(ref, '76561190000000000'); // intruso
    fake.simulateJoin(ref, steamOf(a));
    await orchestrator.tick([room.id]);

    expect(fake.kickedFrom(ref)).toEqual(['76561190000000000']);
    const after = (await matches.findById(match.id))!;
    expect(after.presentSteamIds).toEqual([steamOf(a)]);
    expect(after.status).toBe('waiting_players');
  });

  it('nadie llega a tiempo: se cancela la partida y se reembolsa a TODOS', async () => {
    const { room, a, b } = await fullRoom();
    await orchestrator.onRoomFull(room);
    const match = (await matches.findActiveByRoomId(room.id))!;
    fake.simulateJoin({ id: match.lobbyRef! }, steamOf(a)); // b nunca aparece

    orchestrator.clock = () => new Date(Date.now() + 301_000);
    await orchestrator.tick([room.id]);
    orchestrator.clock = () => new Date();

    const after = (await matches.findById(match.id))!;
    expect(after.status).toBe('failed');
    expect(after.failureReason).toBe('players_no_show');
    expect((await get.execute(room.id)).status).toBe('cancelled');
    expect(await balances(a.userId)).toEqual([5000, 0]);
    expect(await balances(b.userId)).toEqual([5000, 0]);
    expect((await fake.snapshot({ id: match.lobbyRef! }))!.state).toBe(
      'closed',
    );
  });

  it('antes del plazo, un jugador que falta no cancela nada', async () => {
    const { room, a } = await fullRoom();
    await orchestrator.onRoomFull(room);
    const match = (await matches.findActiveByRoomId(room.id))!;
    fake.simulateJoin({ id: match.lobbyRef! }, steamOf(a));
    await orchestrator.tick([room.id]);
    expect((await matches.findById(match.id))!.status).toBe('waiting_players');
    expect((await get.execute(room.id)).status).toBe('full');
  });

  it('resultado desconocido: queda "para revisión" y el admin lo decide', async () => {
    const { room, a, b } = await fullRoom();
    await orchestrator.onRoomFull(room);
    const match = (await matches.findActiveByRoomId(room.id))!;
    const ref = { id: match.lobbyRef! };
    fake.simulateJoin(ref, steamOf(a));
    fake.simulateJoin(ref, steamOf(b));
    await orchestrator.tick([room.id]);
    fake.simulateFinish(ref, 'unknown');
    await orchestrator.tick([room.id]);

    const flagged = (await matches.findById(match.id))!;
    expect(flagged.status).toBe('in_game');
    expect(flagged.needsReview).toBe(true);

    const done = await orchestrator.adminSetResult(match.id, 'radiant');
    expect(done.status).toBe('finished');
    expect(done.needsReview).toBe(false);
    expect(done.resultSource).toBe('admin');
  });

  it('el bot pierde el lobby: en espera se cancela con reembolso; en juego pide revisión', async () => {
    // En espera
    const first = await fullRoom();
    await orchestrator.onRoomFull(first.room);
    const m1 = (await matches.findActiveByRoomId(first.room.id))!;
    fake.simulateLobbyLost({ id: m1.lobbyRef! });
    await orchestrator.tick([first.room.id]);
    expect((await matches.findById(m1.id))!.failureReason).toBe('lobby_lost');
    expect(await balances(first.a.userId)).toEqual([5000, 0]);

    // En juego
    const second = await fullRoom();
    await orchestrator.onRoomFull(second.room);
    const m2 = (await matches.findActiveByRoomId(second.room.id))!;
    const ref = { id: m2.lobbyRef! };
    fake.simulateJoin(ref, steamOf(second.a));
    fake.simulateJoin(ref, steamOf(second.b));
    await orchestrator.tick([second.room.id]);
    fake.simulateLobbyLost(ref);
    await orchestrator.tick([second.room.id]);
    const flagged = (await matches.findById(m2.id))!;
    expect(flagged.status).toBe('in_game');
    expect(flagged.needsReview).toBe(true);
  });

  it('un jugador sale de la sala llena: el lobby se descarta y, al volver a llenarse, se abre otro', async () => {
    const { room, b } = await fullRoom();
    await orchestrator.onRoomFull(room);
    const first = (await matches.findActiveByRoomId(room.id))!;

    await leave.execute(b, room.id); // vuelve a "esperando"
    await orchestrator.tick([room.id]);
    const dropped = (await matches.findById(first.id))!;
    expect(dropped.status).toBe('failed');
    expect(dropped.failureReason).toBe('room_changed');
    expect((await fake.snapshot({ id: first.lobbyRef! }))!.state).toBe(
      'closed',
    );

    const refilled = await join.execute(b, room.id);
    await orchestrator.onRoomFull(refilled);
    const second = (await matches.findActiveByRoomId(room.id))!;
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe('waiting_players');
  });

  it('si el creador cancela mientras se espera en el lobby, el lobby se cierra', async () => {
    const { room, a, b } = await fullRoom();
    await orchestrator.onRoomFull(room);
    const match = (await matches.findActiveByRoomId(room.id))!;
    await cancel.execute(a, room.id);
    await orchestrator.tick([room.id]);
    expect((await matches.findById(match.id))!.status).toBe('failed');
    expect((await fake.snapshot({ id: match.lobbyRef! }))!.state).toBe(
      'closed',
    );
    expect(await balances(b.userId)).toEqual([5000, 0]);
  });

  it('el "tick" recupera salas llenas sin partida (por ejemplo tras reiniciar el servidor)', async () => {
    const { room } = await fullRoom();
    expect(await matches.findActiveByRoomId(room.id)).toBeNull();
    await orchestrator.tick([room.id]);
    expect((await matches.findActiveByRoomId(room.id))!.status).toBe(
      'waiting_players',
    );
  });

  it('no abre dos partidas para la misma sala aunque lo pidan varias veces a la vez', async () => {
    const { room } = await fullRoom();
    await Promise.all([
      orchestrator.onRoomFull(room),
      orchestrator.onRoomFull(room),
      orchestrator.onRoomFull(room),
    ]);
    const all = await matches.findAll();
    expect(all.filter((m) => m.roomId === room.id)).toHaveLength(1);
  });

  it('si el bot no logra abrir el lobby tras varios intentos, cancela y reembolsa (el dinero no queda trabado)', async () => {
    const broken: LobbyProvider = {
      kind: 'fake',
      openLobby: (_config: LobbyConfig) =>
        Promise.reject(new Error('Steam caído')),
      snapshot: () => Promise.resolve(null),
      launch: () => Promise.resolve(),
      kick: () => Promise.resolve(),
      close: () => Promise.resolve(),
    };
    const flaky = buildOrchestrator(broken);
    const { room, a, b } = await fullRoom();

    for (let i = 0; i < 4; i++) {
      await flaky.tick([room.id]);
      expect((await get.execute(room.id)).status).toBe('full'); // sigue reintentando
    }
    await flaky.tick([room.id]); // 5º intento
    expect((await get.execute(room.id)).status).toBe('cancelled');
    expect(await balances(a.userId)).toEqual([5000, 0]);
    expect(await balances(b.userId)).toEqual([5000, 0]);
  });

  it('el dinero sigue cuadrando: el libro coincide con los saldos después de todo esto', async () => {
    for (const id of users.keys()) {
      const wallet = await wallets.findByUserId(id);
      if (wallet) expect((await wallets.reconcile(wallet.id)).ok).toBe(true);
    }
  });
});
