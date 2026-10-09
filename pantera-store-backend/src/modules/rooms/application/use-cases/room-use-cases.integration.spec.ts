import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../../../../shared/testing/test-datasource';
import type { AppConfig } from '../../../../config/configuration';
import { ForbiddenActionException } from '../../../../shared/domain/exceptions/domain.exception';
import { TypeOrmUnitOfWork } from '../../../../shared/infrastructure/typeorm-unit-of-work';
import { User } from '../../../auth/domain/entities/user.entity';
import type { UserRepository } from '../../../auth/domain/ports/user.repository.port';
import {
  LockStakeUseCase,
  ReleaseStakeUseCase,
} from '../../../wallet/application/use-cases/stake-operations.use-cases';
import { LedgerImmutabilityGuard } from '../../../wallet/infrastructure/persistence/ledger-immutability';
import { LedgerEntryOrmEntity } from '../../../wallet/infrastructure/persistence/orm/ledger-entry.orm-entity';
import { WalletOrmEntity } from '../../../wallet/infrastructure/persistence/orm/wallet.orm-entity';
import { TypeOrmWalletRepository } from '../../../wallet/infrastructure/persistence/typeorm-wallet.repository';
import type { Room } from '../../domain/entities/room.entity';
import type { RoomEvents } from '../../domain/ports/room-events.port';
import { RoomOrmEntity } from '../../infrastructure/persistence/orm/room.orm-entity';
import { RoomPlayerOrmEntity } from '../../infrastructure/persistence/orm/room-player.orm-entity';
import { TypeOrmRoomRepository } from '../../infrastructure/persistence/typeorm-room.repository';
import { RoomJoiner } from '../room-joiner';
import {
  type Actor,
  CancelRoomUseCase,
  CreateRoomUseCase,
  JoinRoomUseCase,
  LeaveRoomUseCase,
  ListRoomsUseCase,
} from './room-use-cases';

// Prueba contra Postgres real. Solo corre con WALLET_TEST_DB_URL (base DESECHABLE):
//   WALLET_TEST_DB_URL=postgres://postgres:postgres@localhost:5433/pantera_wallet_test npx jest rooms
const allowSuspensionGate = {
  activeSuspensionOf: () => Promise.resolve(null),
} as unknown as import('../../../../shared/trust/suspension-gate').SuspensionGate;

const url = process.env.WALLET_TEST_DB_URL;
const describeDb = url ? describe : describe.skip;

describeDb('salas (Postgres real)', () => {
  let dataSource: DataSource;
  let wallets: TypeOrmWalletRepository;
  let create: CreateRoomUseCase;
  let join: JoinRoomUseCase;
  let leave: LeaveRoomUseCase;
  let cancel: CancelRoomUseCase;
  let list: ListRoomsUseCase;
  let published: Room[];
  let n = 0;
  const run = Date.now();

  const users = new Map<string, User>();
  const usersRepo: UserRepository = {
    findById: (id) => Promise.resolve(users.get(id) ?? null),
    findBySteamId: () => Promise.resolve(null),
    findByEmail: () => Promise.resolve(null),
    save: () => Promise.resolve(),
  };

  beforeAll(async () => {
    dataSource = await createTestDataSource(url!, [
      WalletOrmEntity,
      LedgerEntryOrmEntity,
      RoomOrmEntity,
      RoomPlayerOrmEntity,
    ]);
    await new LedgerImmutabilityGuard(dataSource).onModuleInit();

    wallets = new TypeOrmWalletRepository(
      dataSource,
      dataSource.getRepository(WalletOrmEntity),
      dataSource.getRepository(LedgerEntryOrmEntity),
    );
    const rooms = new TypeOrmRoomRepository(dataSource);
    const uow = new TypeOrmUnitOfWork(dataSource);
    published = [];
    const events: RoomEvents = { roomChanged: (room) => published.push(room) };
    const lock = new LockStakeUseCase(wallets);
    const release = new ReleaseStakeUseCase(wallets);
    const joiner = new RoomJoiner(lock);
    const config = {
      get: () => ({ platformFeePercent: 10, version: 1 }),
    } as unknown as ConfigService<AppConfig, true>;

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
    list = new ListRoomsUseCase(rooms);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  /** Crea un usuario con saldo disponible (en céntimos) y devuelve quién es. */
  async function player(fundsCents: number): Promise<Actor> {
    const id = `user-${run}-${n++}`;
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
    if (fundsCents > 0) {
      await wallets.append(wallet.id, {
        type: 'DEPOSIT',
        amountCents: fundsCents,
        idempotencyKey: `seed-${id}`,
        createdBy: 'test',
      });
    }
    return { userId: id, steamId: users.get(id)!.steamId, role: 'customer' };
  }

  const balances = async (userId: string) => {
    const w = (await wallets.findByUserId(userId))!;
    return [w.availableCents, w.lockedCents];
  };
  const make = (actor: Actor, over = {}) =>
    create.execute(actor, {
      name: 'Sala de prueba',
      mode: 'captains_mode',
      capacity: 4,
      entryFeeCents: 1100,
      ...over,
    });

  it('crear una sala mete al creador y le bloquea la entrada', async () => {
    const alice = await player(5000);
    const room = await make(alice);
    expect(room.players.map((p) => p.userId)).toEqual([alice.userId]);
    expect(await balances(alice.userId)).toEqual([3900, 1100]);
    expect(published.at(-1)?.id).toBe(room.id);
    expect(
      (await wallets.reconcile((await wallets.findByUserId(alice.userId))!.id))
        .ok,
    ).toBe(true);
  });

  it('sin saldo suficiente NO queda ni la sala ni el bloqueo (todo o nada)', async () => {
    const pobre = await player(500);
    await expect(make(pobre)).rejects.toThrow('insuficiente');
    expect(await balances(pobre.userId)).toEqual([500, 0]);
    const all = await list.execute('all');
    expect(all.some((r) => r.createdBy === pobre.userId)).toBe(false);
  });

  it('unirse bloquea la entrada; la sala se llena y pasa a "lista para jugar"', async () => {
    const [a, b, c, d] = await Promise.all([
      player(2000),
      player(2000),
      player(2000),
      player(2000),
    ]);
    const room = await make(a);
    await join.execute(b, room.id);
    await join.execute(c, room.id);
    const full = await join.execute(d, room.id);
    expect(full.status).toBe('full');
    for (const p of [a, b, c, d])
      expect(await balances(p.userId)).toEqual([900, 1100]);
  });

  it('salir devuelve la entrada y una sala llena vuelve a esperar; puede volver a entrar', async () => {
    const [a, b] = await Promise.all([player(3000), player(3000)]);
    const room = await make(a, { capacity: 2 });
    await join.execute(b, room.id);
    const after = await leave.execute(b, room.id);
    expect(after.status).toBe('waiting');
    expect(await balances(b.userId)).toEqual([3000, 0]);
    // Volver a entrar bloquea de nuevo (es otra participación, no un reintento).
    await join.execute(b, room.id);
    expect(await balances(b.userId)).toEqual([1900, 1100]);
  });

  it('cancelar reembolsa a TODOS y deja la sala cancelada', async () => {
    const [a, b, c] = await Promise.all([
      player(2000),
      player(2000),
      player(2000),
    ]);
    const room = await make(a);
    await join.execute(b, room.id);
    await join.execute(c, room.id);
    const cancelled = await cancel.execute(a, room.id);
    expect(cancelled.status).toBe('cancelled');
    for (const p of [a, b, c]) {
      expect(await balances(p.userId)).toEqual([2000, 0]);
      expect(
        (await wallets.reconcile((await wallets.findByUserId(p.userId))!.id))
          .ok,
      ).toBe(true);
    }
  });

  it('solo el creador o un admin pueden cancelar', async () => {
    const [a, b] = await Promise.all([player(2000), player(2000)]);
    const room = await make(a);
    await join.execute(b, room.id);
    await expect(cancel.execute(b, room.id)).rejects.toThrow(
      ForbiddenActionException,
    );
    const admin: Actor = { userId: 'admin-x', steamId: '1', role: 'admin' };
    expect((await cancel.execute(admin, room.id)).status).toBe('cancelled');
  });

  it('un jugador no puede estar en dos salas vivas a la vez, y no se le cobra la segunda', async () => {
    const [a, b] = await Promise.all([player(5000), player(5000)]);
    const room1 = await make(a);
    const room2 = await make(b);
    await join.execute(a, room2.id).then(
      () => {
        throw new Error('debió fallar');
      },
      (e: Error) => expect(e.message).toContain('otra sala activa'),
    );
    expect(await balances(a.userId)).toEqual([3900, 1100]); // solo la primera
    expect(
      (await join
        .execute(b, room1.id)
        .catch((e: Error) => e.message)) as string,
    ).toContain('otra sala activa');
  });

  it('intentar entrar a dos salas AL MISMO TIEMPO: solo entra a una', async () => {
    const [x, y, z] = await Promise.all([
      player(5000),
      player(5000),
      player(5000),
    ]);
    const r1 = await make(x);
    const r2 = await make(y);
    const results = await Promise.allSettled([
      join.execute(z, r1.id),
      join.execute(z, r2.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balances(z.userId)).toEqual([3900, 1100]);
  });

  it('10 jugadores entran a la vez a una sala de 4 (3 cupos libres): nunca se pasa el cupo ni se cobra de más', async () => {
    const owner = await player(2000);
    const room = await make(owner);
    const crowd = await Promise.all(
      Array.from({ length: 10 }, () => player(2000)),
    );
    const results = await Promise.allSettled(
      crowd.map((p) => join.execute(p, room.id)),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    const final = (await list.execute('all')).find((r) => r.id === room.id)!;
    expect(final.players).toHaveLength(4);
    expect(final.status).toBe('full');

    const inside = new Set(final.players.map((p) => p.userId));
    for (const p of crowd) {
      // Los que entraron pagaron; los que quedaron fuera conservan todo.
      expect(await balances(p.userId)).toEqual(
        inside.has(p.userId) ? [900, 1100] : [2000, 0],
      );
    }
  });

  it('el mismo jugador entrando dos veces a la vez a la misma sala: una sola entrada', async () => {
    const [owner, guest] = await Promise.all([player(2000), player(2000)]);
    const room = await make(owner);
    const results = await Promise.allSettled([
      join.execute(guest, room.id),
      join.execute(guest, room.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balances(guest.userId)).toEqual([900, 1100]);
  });

  it('sin Steam vinculado no se puede jugar', async () => {
    const sinSteam = await player(2000);
    await expect(make({ ...sinSteam, steamId: undefined })).rejects.toThrow(
      'Steam',
    );
  });

  it('el listado separa salas activas de terminadas', async () => {
    const a = await player(2000);
    const room = await make(a);
    expect((await list.execute('active')).some((r) => r.id === room.id)).toBe(
      true,
    );
    await cancel.execute(a, room.id);
    expect((await list.execute('active')).some((r) => r.id === room.id)).toBe(
      false,
    );
    expect((await list.execute('finished')).some((r) => r.id === room.id)).toBe(
      true,
    );
  });
});
