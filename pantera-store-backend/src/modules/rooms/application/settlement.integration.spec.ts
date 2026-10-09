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
import { ManualLobbyProvider } from '../infrastructure/lobby/manual-lobby.provider';
import { MatchOrmEntity } from '../infrastructure/persistence/orm/match.orm-entity';
import { RoomOrmEntity } from '../infrastructure/persistence/orm/room.orm-entity';
import { RoomPlayerOrmEntity } from '../infrastructure/persistence/orm/room-player.orm-entity';
import { SettlementOrmEntity } from '../infrastructure/persistence/orm/settlement.orm-entity';
import { TypeOrmMatchRepository } from '../infrastructure/persistence/typeorm-match.repository';
import { TypeOrmRoomRepository } from '../infrastructure/persistence/typeorm-room.repository';
import { TypeOrmSettlementRepository } from '../infrastructure/persistence/typeorm-settlement.repository';
import { MatchOrchestrator } from './match-orchestrator';
import { RoomJoiner } from './room-joiner';
import {
  type Actor,
  CancelRoomUseCase,
  CreateRoomUseCase,
  GetRoomUseCase,
  JoinRoomUseCase,
} from './use-cases/room-use-cases';
import {
  ListMyMatchHistoryUseCase,
  SettleMatchUseCase,
  VoidMatchUseCase,
} from './use-cases/settlement-use-cases';

// Prueba contra Postgres real. Solo corre con WALLET_TEST_DB_URL (base DESECHABLE):
//   WALLET_TEST_DB_URL=postgres://postgres:postgres@localhost:5433/pantera_wallet_test npx jest settlement
const allowSuspensionGate = {
  activeSuspensionOf: () => Promise.resolve(null),
} as unknown as import('../../../shared/trust/suspension-gate').SuspensionGate;
const fakeActivityFeed = {
  record: () => Promise.resolve(),
  list: () => Promise.resolve([]),
} as unknown as import('../../../shared/activity/domain/activity-feed.port').ActivityFeed;

const url = process.env.WALLET_TEST_DB_URL;
const describeDb = url ? describe : describe.skip;

describeDb('liquidación de partidas (Postgres real)', () => {
  let dataSource: DataSource;
  let wallets: TypeOrmWalletRepository;
  let rooms: TypeOrmRoomRepository;
  let matches: TypeOrmMatchRepository;
  let settlements: TypeOrmSettlementRepository;
  let create: CreateRoomUseCase;
  let join: JoinRoomUseCase;
  let get: GetRoomUseCase;
  let settle: SettleMatchUseCase;
  let voidMatch: VoidMatchUseCase;
  let history: ListMyMatchHistoryUseCase;
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
  const configFor = (feePercent: number) =>
    ({
      get: (key: string) =>
        ({
          matches: {
            provider: 'manual',
            joinTimeoutSec: 300,
            pollIntervalSec: 5,
          },
          rooms: { platformFeePercent: feePercent },
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
    const uow = new TypeOrmUnitOfWork(dataSource);
    const events = { roomChanged: () => undefined };
    const release = new ReleaseStakeUseCase(wallets);
    const joiner = new RoomJoiner(new LockStakeUseCase(wallets));
    const cancel = new CancelRoomUseCase(rooms, uow, events, release);

    create = new CreateRoomUseCase(
      rooms,
      usersRepo,
      uow,
      events,
      joiner,
      configFor(10),
      allowSuspensionGate,
    );
    join = new JoinRoomUseCase(
      rooms,
      usersRepo,
      uow,
      events,
      joiner,
      configFor(10),
      allowSuspensionGate,
    );
    get = new GetRoomUseCase(rooms);
    settle = buildSettle(new CollectPlatformFeeUseCase(wallets));
    voidMatch = new VoidMatchUseCase(rooms, matches, uow, events, release);
    history = new ListMyMatchHistoryUseCase(rooms, matches, settlements);
    orchestrator = new MatchOrchestrator(
      rooms,
      matches,
      usersRepo,
      new ManualLobbyProvider(),
      uow,
      events,
      cancel,
      configFor(10),
      settle,
    );
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  function buildSettle(collect: CollectPlatformFeeUseCase): SettleMatchUseCase {
    return new SettleMatchUseCase(
      rooms,
      matches,
      settlements,
      new TypeOrmUnitOfWork(dataSource),
      { roomChanged: () => undefined },
      fakeActivityFeed,
      new ChargeStakeUseCase(wallets),
      new PayPrizeUseCase(wallets),
      collect,
    );
  }

  async function player(fundsCents = 5000): Promise<Actor> {
    const id = `st-user-${run}-${n++}`;
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
  /** Comisión que cobró la plataforma por ESTA sala (se mide por el libro, no por el saldo global: otras pruebas corren en paralelo). */
  const platformFeeFor = async (roomId: string) => {
    const rows = await dataSource.getRepository(LedgerEntryOrmEntity).find({
      where: {
        referenceType: 'room',
        referenceId: roomId,
        type: 'PLATFORM_FEE',
      },
    });
    return rows.reduce((sum, r) => sum + r.availableDeltaCents, 0);
  };

  /** Una sala llena y en juego (modo manual), con `capacity` jugadores. */
  async function playingRoom(
    capacity: number,
    entryFeeCents: number,
    fee = 10,
  ) {
    const players = await Promise.all(
      Array.from({ length: capacity }, () => player()),
    );
    const creator =
      fee === 10
        ? create
        : new CreateRoomUseCase(
            rooms,
            usersRepo,
            new TypeOrmUnitOfWork(dataSource),
            { roomChanged: () => undefined },
            new RoomJoiner(new LockStakeUseCase(wallets)),
            configFor(fee),
            allowSuspensionGate,
          );
    let room: Room = await creator.execute(players[0], {
      name: 'Sala liquidable',
      mode: 'all_pick',
      capacity,
      entryFeeCents,
    });
    for (const p of players.slice(1)) room = await join.execute(p, room.id);
    await orchestrator.onRoomFull(room);
    const match = (await matches.findActiveByRoomId(room.id))!;
    return { room, match, players };
  }

  const teamsOf = (
    match: Awaited<ReturnType<typeof playingRoom>>['match'],
  ) => ({
    radiant: match.participants
      .filter((p) => p.team === 'radiant')
      .map((p) => p.userId),
    dire: match.participants
      .filter((p) => p.team === 'dire')
      .map((p) => p.userId),
  });

  it('el ganador cobra el premio, el perdedor pierde su entrada y la plataforma recibe la comisión', async () => {
    const { room, match, players } = await playingRoom(4, 1100);
    await orchestrator.adminSetResult(match.id, 'radiant'); // liquida solo
    const { radiant, dire } = teamsOf(match);

    // Cada ganador: 5000 - 1100 + 1980; cada perdedor: 5000 - 1100.
    for (const id of radiant) expect(await balances(id)).toEqual([5880, 0]);
    for (const id of dire) expect(await balances(id)).toEqual([3900, 0]);
    expect(await platformFeeFor(match.roomId)).toBe(440);
    expect((await get.execute(room.id)).status).toBe('finished');

    // La plata del sistema no cambió: lo que entró a la caja = lo que salió de los jugadores.
    const totalNow = (
      await Promise.all(players.map((p) => balances(p.userId)))
    ).reduce((s, [a, l]) => s + a + l, 0);
    expect(totalNow + 440).toBe(5000 * 4);
  });

  it('el registro de la liquidación queda guardado con el detalle de cada jugador', async () => {
    const { match } = await playingRoom(4, 1100);
    await orchestrator.adminSetResult(match.id, 'dire');
    const s = (await settlements.findByMatchId(match.id))!;
    expect(s.playerCount).toBe(4);
    expect(s.prizePoolCents).toBe(3960);
    expect(s.prizeEachCents).toBe(1980);
    expect(s.platformCents).toBe(440);
    expect(s.payouts).toHaveLength(4);
    expect(
      s.payouts
        .filter((p) => p.won)
        .every((p) => p.team === 'dire' && p.prizeCents === 1980),
    ).toBe(true);
    expect(
      s.payouts.filter((p) => !p.won).every((p) => p.prizeCents === 0),
    ).toBe(true);
  });

  it('el libro de cada jugador cuenta la historia: bloqueo, cobro y premio', async () => {
    const { match } = await playingRoom(4, 1100);
    await orchestrator.adminSetResult(match.id, 'radiant');
    const winner = teamsOf(match).radiant[0];
    const wallet = (await wallets.findByUserId(winner))!;
    const types = (await wallets.listEntries(wallet.id))
      .map((e) => e.type)
      .reverse();
    expect(types).toEqual(['DEPOSIT', 'STAKE_LOCK', 'STAKE_CHARGE', 'PRIZE']);
    expect((await wallets.reconcile(wallet.id)).ok).toBe(true);
  });

  it('los céntimos sobrantes se los queda la plataforma y todo sigue cuadrando', async () => {
    // 6 x S/ 3.33 = 1998; comisión 10% = 199; bolsa 1799; 3 ganadores -> 599 c/u; plataforma 201.
    const { match, players } = await playingRoom(6, 333);
    await orchestrator.adminSetResult(match.id, 'radiant');
    const s = (await settlements.findByMatchId(match.id))!;
    expect(s.prizeEachCents).toBe(599);
    expect(s.platformCents).toBe(201);
    expect(await platformFeeFor(match.roomId)).toBe(201);
    const total = (
      await Promise.all(players.map((p) => balances(p.userId)))
    ).reduce((sum, [a, l]) => sum + a + l, 0);
    expect(total + 201).toBe(5000 * 6);
  });

  it('sala sin comisión (0%): todo el dinero va a los ganadores', async () => {
    const { match } = await playingRoom(2, 1000, 0);
    await orchestrator.adminSetResult(match.id, 'radiant');
    const s = (await settlements.findByMatchId(match.id))!;
    expect(s.prizeEachCents).toBe(2000);
    expect(s.platformCents).toBe(0);
    expect(await platformFeeFor(match.roomId)).toBe(0);
  });

  it('liquidar dos veces NO paga dos veces', async () => {
    const { match, players } = await playingRoom(4, 1100);
    await orchestrator.adminSetResult(match.id, 'radiant');
    const before = await Promise.all(players.map((p) => balances(p.userId)));
    const entriesBefore = (
      await wallets.listEntries(
        (await wallets.findByUserId(players[0].userId))!.id,
      )
    ).length;

    const again = await settle.execute(match.id);
    expect(again.matchId).toBe(match.id);
    expect(await Promise.all(players.map((p) => balances(p.userId)))).toEqual(
      before,
    );
    expect(
      (
        await wallets.listEntries(
          (await wallets.findByUserId(players[0].userId))!.id,
        )
      ).length,
    ).toBe(entriesBefore);
  });

  it('cinco liquidaciones AL MISMO TIEMPO: se paga una sola vez', async () => {
    const { match, players } = await playingRoom(4, 1100);
    // Se deja la partida con resultado pero sin liquidar, y se dispara todo junto.
    const m = (await matches.findById(match.id))!;
    m.finish({ outcome: 'dire', source: 'admin' });
    await matches.save(m);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => settle.execute(match.id)),
    );
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const settled = await dataSource
      .getRepository(SettlementOrmEntity)
      .count({ where: { matchId: match.id } });
    expect(settled).toBe(1);
    expect(await platformFeeFor(match.roomId)).toBe(440);
    const total = (
      await Promise.all(players.map((p) => balances(p.userId)))
    ).reduce((s, [a, l]) => s + a + l, 0);
    expect(total + 440).toBe(5000 * 4);
  });

  it('si algo falla a mitad de la liquidación, NO queda nada a medias (todo o nada) y se puede reintentar', async () => {
    const failing: CollectPlatformFeeUseCase = {
      execute: () =>
        Promise.reject(new Error('falla simulada al cobrar la comisión')),
    } as unknown as CollectPlatformFeeUseCase;
    const flaky = buildSettle(failing);

    const { room, match, players } = await playingRoom(4, 1100);
    const m = (await matches.findById(match.id))!;
    m.finish({ outcome: 'radiant', source: 'admin' });
    await matches.save(m);

    await expect(flaky.execute(match.id)).rejects.toThrow('falla simulada');
    // Nada se movió: las entradas siguen bloqueadas y la sala sigue "jugando".
    for (const p of players)
      expect(await balances(p.userId)).toEqual([3900, 1100]);
    expect((await get.execute(room.id)).status).toBe('playing');
    expect(await settlements.findByMatchId(match.id)).toBeNull();
    expect(await platformFeeFor(match.roomId)).toBe(0);

    // Con el servicio sano, el reintento paga bien.
    await settle.execute(match.id);
    expect((await get.execute(room.id)).status).toBe('finished');
    expect(await platformFeeFor(match.roomId)).toBe(440);
  });

  it('una partida con resultado que quedó sin pagar se recupera sola en la siguiente revisión', async () => {
    const { room, match } = await playingRoom(2, 1000);
    const m = (await matches.findById(match.id))!;
    m.finish({ outcome: 'radiant', source: 'admin' });
    await matches.save(m); // el servidor "se cayó" antes de liquidar
    expect((await get.execute(room.id)).status).toBe('playing');

    await orchestrator.tick([room.id]);
    expect((await get.execute(room.id)).status).toBe('finished');
    expect(await settlements.findByMatchId(match.id)).not.toBeNull();
  });

  it('no se liquida una partida que todavía no tiene resultado', async () => {
    const { room, match, players } = await playingRoom(2, 1000);
    await expect(settle.execute(match.id)).rejects.toThrow(
      'todavía no tiene un resultado',
    );
    for (const p of players)
      expect(await balances(p.userId)).toEqual([4000, 1000]);
    expect((await get.execute(room.id)).status).toBe('playing');
  });

  it('anular por empate o partida inválida reembolsa a TODOS y nadie gana', async () => {
    const { room, match, players } = await playingRoom(4, 1100);
    const voided = await voidMatch.execute(
      match.id,
      'empate: se cayó el servidor',
    );

    expect(voided.status).toBe('voided');
    expect((await get.execute(room.id)).status).toBe('cancelled');
    for (const p of players)
      expect(await balances(p.userId)).toEqual([5000, 0]);
    expect(await platformFeeFor(match.roomId)).toBe(0);
    expect(await settlements.findByMatchId(match.id)).toBeNull();
    await expect(settle.execute(match.id)).rejects.toThrow(
      'todavía no tiene un resultado',
    );
  });

  it('una partida anulada no se puede anular ni decidir de nuevo, y una pagada no se puede anular', async () => {
    const a = await playingRoom(2, 1000);
    await voidMatch.execute(a.match.id, 'inválida');
    await expect(voidMatch.execute(a.match.id, 'otra vez')).rejects.toThrow();
    await expect(
      orchestrator.adminSetResult(a.match.id, 'radiant'),
    ).rejects.toThrow();

    const b = await playingRoom(2, 1000);
    await orchestrator.adminSetResult(b.match.id, 'radiant');
    await expect(voidMatch.execute(b.match.id, 'tarde')).rejects.toThrow();
  });

  it('el historial de cada jugador muestra qué ganó, qué perdió y qué le reembolsaron', async () => {
    const { match } = await playingRoom(2, 1000);
    await orchestrator.adminSetResult(match.id, 'radiant');
    const { radiant, dire } = teamsOf(match);

    const winnerHistory = await history.execute(radiant[0]);
    expect(winnerHistory).toHaveLength(1);
    expect(winnerHistory[0]).toMatchObject({
      result: 'won',
      entryFeeCents: 1000,
      prizeCents: 1800,
      netCents: 800,
      yourTeam: 'radiant',
    });

    const loserHistory = await history.execute(dire[0]);
    expect(loserHistory[0]).toMatchObject({
      result: 'lost',
      prizeCents: 0,
      netCents: -1000,
    });

    // Anulada: reembolsada, sin ganancia ni pérdida.
    const other = await playingRoom(2, 1000);
    await voidMatch.execute(other.match.id, 'empate');
    const refunded = await history.execute(other.players[0].userId);
    expect(refunded[0]).toMatchObject({
      result: 'refunded',
      netCents: 0,
      reason: 'empate',
    });
  });

  it('el historial va de lo más nuevo a lo más viejo y solo trae partidas del jugador', async () => {
    const p = await player(20_000);
    const q = await player(20_000);
    for (let i = 0; i < 3; i++) {
      let room: Room = await create.execute(p, {
        name: `Ronda ${i}`,
        mode: 'turbo',
        capacity: 2,
        entryFeeCents: 500,
      });
      room = await join.execute(q, room.id);
      await orchestrator.onRoomFull(room);
      const m = (await matches.findActiveByRoomId(room.id))!;
      await orchestrator.adminSetResult(m.id, 'radiant');
    }
    const list = await history.execute(p.userId);
    expect(list.map((e) => e.roomName)).toEqual([
      'Ronda 2',
      'Ronda 1',
      'Ronda 0',
    ]);
    const stranger = await player();
    expect(await history.execute(stranger.userId)).toEqual([]);
  });

  it('DESPUÉS DE TODO: el libro de cada billetera coincide con su saldo', async () => {
    for (const id of [...users.keys(), 'platform']) {
      const wallet = await wallets.findByUserId(id);
      if (wallet) expect((await wallets.reconcile(wallet.id)).ok).toBe(true);
    }
  });
});
