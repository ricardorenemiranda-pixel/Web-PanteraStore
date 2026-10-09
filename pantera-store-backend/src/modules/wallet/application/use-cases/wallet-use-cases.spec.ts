import type { ConfigService } from '@nestjs/config';
import {
  EntityNotFoundException,
  InvalidDomainStateException,
} from '../../../../shared/domain/exceptions/domain.exception';
import type { AppConfig } from '../../../../config/configuration';
import { User } from '../../../auth/domain/entities/user.entity';
import type { UserRepository } from '../../../auth/domain/ports/user.repository.port';
import {
  deltaFor,
  LedgerEntry,
  type NewLedgerEntry,
  validateNewEntry,
} from '../../domain/entities/ledger-entry.entity';
import { Wallet } from '../../domain/entities/wallet.entity';
import type {
  AppendResult,
  WalletRepository,
} from '../../domain/ports/wallet.repository.port';
import {
  CreditTestBalanceUseCase,
  LookupWalletUserUseCase,
  MAX_TEST_CREDIT_CENTS,
} from './admin-test-balance.use-cases';
import { GetWalletUseCase } from './get-wallet.use-case';
import {
  ChargeStakeUseCase,
  LockStakeUseCase,
  PayPrizeUseCase,
  ReleaseStakeUseCase,
} from './stake-operations.use-cases';

/** Repositorio en memoria con las mismas reglas que el real (sin base de datos). */
class InMemoryWalletRepository implements WalletRepository {
  wallets = new Map<string, Wallet>();
  entries: LedgerEntry[] = [];

  findById(id: string) {
    return Promise.resolve(this.wallets.get(id) ?? null);
  }
  findByUserId(userId: string) {
    return Promise.resolve(
      [...this.wallets.values()].find((w) => w.userId === userId) ?? null,
    );
  }
  async getOrCreateForUser(userId: string) {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;
    const wallet = Wallet.create({
      id: `w-${this.wallets.size + 1}`,
      userId,
      kind: 'user',
    });
    this.wallets.set(wallet.id, wallet);
    return wallet;
  }
  append(walletId: string, draft: NewLedgerEntry): Promise<AppendResult> {
    validateNewEntry(draft);
    const wallet = this.wallets.get(walletId)!;
    const delta = deltaFor(draft.type, draft.amountCents, draft.direction);
    const previous = this.entries.find(
      (e) => e.idempotencyKey === draft.idempotencyKey,
    );
    if (previous)
      return Promise.resolve({ entry: previous, wallet, replayed: true });
    wallet.applyDelta(delta);
    const entry = LedgerEntry.restore({
      id: `e-${this.entries.length + 1}`,
      walletId,
      type: draft.type,
      availableDeltaCents: delta.availableCents,
      lockedDeltaCents: delta.lockedCents,
      availableAfterCents: wallet.availableCents,
      lockedAfterCents: wallet.lockedCents,
      referenceType: draft.referenceType,
      referenceId: draft.referenceId,
      idempotencyKey: draft.idempotencyKey,
      description: draft.description,
      createdBy: draft.createdBy,
      createdAt: new Date(),
    });
    this.entries.push(entry);
    return Promise.resolve({ entry, wallet, replayed: false });
  }
  listEntries(walletId: string) {
    return Promise.resolve(this.entries.filter((e) => e.walletId === walletId));
  }
  reconcile(): never {
    throw new Error('no usado');
  }
}

const alice = User.create({
  id: 'user-alice',
  steamId: '76561198000000001',
  displayName: 'Alice',
  role: 'customer',
  email: 'alice@example.com',
});

const users: UserRepository = {
  findById: (id) => Promise.resolve(id === alice.id ? alice : null),
  findBySteamId: (id) => Promise.resolve(id === alice.steamId ? alice : null),
  findByEmail: (email) => Promise.resolve(email === alice.email ? alice : null),
  save: () => Promise.resolve(),
};

const configWith = (testCreditsEnabled: boolean) =>
  ({
    get: () => ({ testCreditsEnabled }),
  }) as unknown as ConfigService<AppConfig, true>;

describe('operaciones de sala (bloquear, liberar, cobrar, pagar)', () => {
  let repo: InMemoryWalletRepository;
  let lock: LockStakeUseCase;
  let release: ReleaseStakeUseCase;
  let charge: ChargeStakeUseCase;
  let prize: PayPrizeUseCase;
  const room = (userId = 'u1', amountCents = 1100) => ({
    userId,
    amountCents,
    referenceType: 'room',
    referenceId: 'sala-1',
  });

  beforeEach(async () => {
    repo = new InMemoryWalletRepository();
    lock = new LockStakeUseCase(repo);
    release = new ReleaseStakeUseCase(repo);
    charge = new ChargeStakeUseCase(repo);
    prize = new PayPrizeUseCase(repo);
    const wallet = await repo.getOrCreateForUser('u1');
    await repo.append(wallet.id, {
      type: 'DEPOSIT',
      amountCents: 5000,
      idempotencyKey: 'seed',
      createdBy: 'system',
    });
  });

  const balances = async () => {
    const w = (await repo.findByUserId('u1'))!;
    return [w.availableCents, w.lockedCents];
  };

  it('bloquear mueve disponible -> bloqueado', async () => {
    await lock.execute(room());
    expect(await balances()).toEqual([3900, 1100]);
  });

  it('bloquear dos veces la misma sala NO cobra dos veces', async () => {
    const first = await lock.execute(room());
    const second = await lock.execute(room());
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(await balances()).toEqual([3900, 1100]);
  });

  it('sala cancelada: bloquear y liberar deja el saldo como estaba', async () => {
    await lock.execute(room());
    await release.execute(room());
    expect(await balances()).toEqual([5000, 0]);
  });

  it('sala jugada: bloquear, cobrar y pagar el premio', async () => {
    await lock.execute(room());
    await charge.execute(room());
    await prize.execute(room('u1', 2000));
    expect(await balances()).toEqual([5900, 0]);
  });

  it('no deja bloquear más de lo disponible', async () => {
    await expect(lock.execute(room('u1', 5001))).rejects.toThrow(
      InvalidDomainStateException,
    );
    expect(await balances()).toEqual([5000, 0]);
  });

  it('no deja cobrar ni liberar lo que no está bloqueado', async () => {
    await expect(charge.execute(room())).rejects.toThrow(
      InvalidDomainStateException,
    );
    await expect(release.execute(room())).rejects.toThrow(
      InvalidDomainStateException,
    );
  });

  it('un usuario sin billetera la recibe automáticamente (en cero)', async () => {
    const view = await new GetWalletUseCase(repo).execute('nuevo');
    expect(view.wallet.availableCents).toBe(0);
    expect(view.entries).toEqual([]);
  });
});

describe('saldo de prueba (admin)', () => {
  const build = (enabled = true) => {
    const repo = new InMemoryWalletRepository();
    const lookup = new LookupWalletUserUseCase(
      users,
      new GetWalletUseCase(repo),
    );
    return {
      repo,
      credit: new CreditTestBalanceUseCase(repo, lookup, configWith(enabled)),
    };
  };
  const input = (over = {}) => ({
    adminId: 'admin-1',
    userQuery: 'alice@example.com',
    amountCents: 2500,
    reason: 'pruebas de salas',
    requestId: 'req-12345678',
    ...over,
  });

  it('acredita como AJUSTE registrando admin y motivo', async () => {
    const { credit, repo } = build();
    const result = await credit.execute(input());
    expect(result.wallet.availableCents).toBe(2500);
    expect(result.entry.type).toBe('ADJUSTMENT');
    expect(result.entry.createdBy).toBe('admin-1');
    expect(result.entry.description).toContain('pruebas de salas');
    expect(repo.entries).toHaveLength(1);
  });

  it('encuentra al usuario por id, SteamID64 o email', async () => {
    for (const [i, userQuery] of [
      alice.id,
      alice.steamId!,
      'ALICE@example.com',
    ].entries()) {
      const { credit } = build();
      const r = await credit.execute(
        input({ userQuery, requestId: `req-0000000${i}` }),
      );
      expect(r.user.id).toBe(alice.id);
    }
  });

  it('un doble clic (mismo requestId) acredita una sola vez', async () => {
    const { credit } = build();
    await credit.execute(input());
    const again = await credit.execute(input());
    expect(again.replayed).toBe(true);
    expect(again.wallet.availableCents).toBe(2500);
  });

  it('usuario inexistente', async () => {
    const { credit } = build();
    await expect(credit.execute(input({ userQuery: 'nadie' }))).rejects.toThrow(
      EntityNotFoundException,
    );
  });

  it('desactivado por configuración (producción)', async () => {
    const { credit, repo } = build(false);
    await expect(credit.execute(input())).rejects.toThrow('desactivado');
    expect(repo.entries).toHaveLength(0);
  });

  it('respeta el tope por operación', async () => {
    const { credit } = build();
    await expect(
      credit.execute(input({ amountCents: MAX_TEST_CREDIT_CENTS + 1 })),
    ).rejects.toThrow('máximo');
  });
});
