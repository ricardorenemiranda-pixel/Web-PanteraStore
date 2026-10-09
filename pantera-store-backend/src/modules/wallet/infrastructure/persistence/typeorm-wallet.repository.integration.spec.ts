import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../../../../shared/testing/test-datasource';
import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { LedgerImmutabilityGuard } from './ledger-immutability';
import { LedgerEntryOrmEntity } from './orm/ledger-entry.orm-entity';
import { WalletOrmEntity } from './orm/wallet.orm-entity';
import { TypeOrmWalletRepository } from './typeorm-wallet.repository';

// Prueba contra Postgres real. Solo corre si defines WALLET_TEST_DB_URL
// apuntando a una base DESECHABLE (crea tablas y los movimientos no se pueden borrar):
//   WALLET_TEST_DB_URL=postgres://postgres:postgres@localhost:5433/pantera_wallet_test npm test -- wallet
const url = process.env.WALLET_TEST_DB_URL;
const describeDb = url ? describe : describe.skip;

describeDb('TypeOrmWalletRepository (Postgres real)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmWalletRepository;
  let counter = 0;
  const run = Date.now();
  const key = (label: string) => `${run}-${label}-${counter++}`;

  beforeAll(async () => {
    dataSource = await createTestDataSource(url!, [
      WalletOrmEntity,
      LedgerEntryOrmEntity,
    ]);
    await new LedgerImmutabilityGuard(dataSource).onModuleInit();
    repo = new TypeOrmWalletRepository(
      dataSource,
      dataSource.getRepository(WalletOrmEntity),
      dataSource.getRepository(LedgerEntryOrmEntity),
    );
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  const newWallet = () => repo.getOrCreateForUser(`user-${run}-${counter++}`);

  it('crea una sola billetera por usuario, aun con pedidos simultáneos', async () => {
    const userId = `user-${run}-race`;
    const wallets = await Promise.all(
      Array.from({ length: 10 }, () => repo.getOrCreateForUser(userId)),
    );
    expect(new Set(wallets.map((w) => w.id)).size).toBe(1);
  });

  it('registra movimientos con saldos y foto posterior correctos', async () => {
    const w = await newWallet();
    await repo.append(w.id, {
      type: 'DEPOSIT',
      amountCents: 5000,
      idempotencyKey: key('dep'),
      createdBy: 'admin-1',
    });
    const lock = await repo.append(w.id, {
      type: 'STAKE_LOCK',
      amountCents: 1100,
      referenceType: 'room',
      referenceId: 'sala-1',
      idempotencyKey: key('lock'),
      createdBy: w.userId,
    });
    expect(lock.entry.availableAfterCents).toBe(3900);
    expect(lock.entry.lockedAfterCents).toBe(1100);
    expect((await repo.findById(w.id))!.availableCents).toBe(3900);
    expect((await repo.reconcile(w.id)).ok).toBe(true);
  });

  it('un reintento con la misma clave NO mueve plata dos veces', async () => {
    const w = await newWallet();
    const k = key('retry');
    const draft = {
      type: 'DEPOSIT' as const,
      amountCents: 1000,
      idempotencyKey: k,
      createdBy: 'system',
    };
    const first = await repo.append(w.id, draft);
    const second = await repo.append(w.id, draft);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.entry.id).toBe(first.entry.id);
    expect((await repo.findById(w.id))!.availableCents).toBe(1000);
    await expect(
      repo.append(w.id, { ...draft, amountCents: 999 }),
    ).rejects.toThrow(InvalidDomainStateException);
  });

  it('rechaza gastar más de lo disponible y no deja rastro', async () => {
    const w = await newWallet();
    await repo.append(w.id, {
      type: 'DEPOSIT',
      amountCents: 1000,
      idempotencyKey: key('d'),
      createdBy: 'system',
    });
    await expect(
      repo.append(w.id, {
        type: 'STAKE_LOCK',
        amountCents: 1001,
        idempotencyKey: key('over'),
        createdBy: 'u',
      }),
    ).rejects.toThrow('insuficiente');
    expect(await repo.listEntries(w.id)).toHaveLength(1);
    expect((await repo.reconcile(w.id)).ok).toBe(true);
  });

  it('20 cobros simultáneos sobre la misma billetera: nunca se pasa de cero y cuadra', async () => {
    const w = await newWallet();
    await repo.append(w.id, {
      type: 'DEPOSIT',
      amountCents: 1000,
      idempotencyKey: key('d'),
      createdBy: 'system',
    });
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        repo.append(w.id, {
          type: 'WITHDRAWAL',
          amountCents: 100,
          idempotencyKey: key(`w${i}`),
          createdBy: 'u',
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10);
    const final = await repo.findById(w.id);
    expect(final!.availableCents).toBe(0);
    expect((await repo.reconcile(w.id)).ok).toBe(true);
  });

  it('bloqueos, liberaciones y cobros mezclados y simultáneos: el dinero total nunca se altera', async () => {
    const w = await newWallet();
    await repo.append(w.id, {
      type: 'DEPOSIT',
      amountCents: 10000,
      idempotencyKey: key('seed'),
      createdBy: 'system',
    });
    // 10 salas: se bloquea la entrada de todas a la vez...
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        repo.append(w.id, {
          type: 'STAKE_LOCK',
          amountCents: 1000,
          idempotencyKey: key(`lock${i}`),
          createdBy: 'u',
        }),
      ),
    );
    // ...y luego, a la vez, 5 se cancelan (liberar) y 5 se juegan (cobrar).
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        repo.append(w.id, {
          type: i % 2 === 0 ? 'STAKE_RELEASE' : 'STAKE_CHARGE',
          amountCents: 1000,
          idempotencyKey: key(`settle${i}`),
          createdBy: 'system',
        }),
      ),
    );
    const final = await repo.findById(w.id);
    expect(final!.availableCents).toBe(5000); // 10000 - 10 bloqueos + 5 devueltos
    expect(final!.lockedCents).toBe(0);
    expect((await repo.reconcile(w.id)).ok).toBe(true);
  });

  it('la base de datos rechaza editar o borrar un movimiento', async () => {
    const w = await newWallet();
    const { entry } = await repo.append(w.id, {
      type: 'DEPOSIT',
      amountCents: 100,
      idempotencyKey: key('imm'),
      createdBy: 'system',
    });
    await expect(
      dataSource.query(
        `UPDATE wallet_ledger_entries SET "availableDeltaCents" = 999999 WHERE id = $1`,
        [entry.id],
      ),
    ).rejects.toThrow('solo escritura');
    await expect(
      dataSource.query(`DELETE FROM wallet_ledger_entries WHERE id = $1`, [
        entry.id,
      ]),
    ).rejects.toThrow('solo escritura');
  });

  it('la base de datos rechaza un saldo negativo aunque se salte el código', async () => {
    const w = await newWallet();
    await expect(
      dataSource.query(
        `UPDATE wallets SET "availableCents" = -1 WHERE id = $1`,
        [w.id],
      ),
    ).rejects.toThrow();
  });

  it('lista los movimientos del más nuevo al más viejo', async () => {
    const w = await newWallet();
    for (let i = 0; i < 3; i++) {
      await repo.append(w.id, {
        type: 'DEPOSIT',
        amountCents: 100,
        idempotencyKey: key(`l${i}`),
        createdBy: 's',
      });
    }
    const list = await repo.listEntries(w.id, { limit: 2 });
    expect(list).toHaveLength(2);
    expect(list[0].createdAt.getTime()).toBeGreaterThanOrEqual(
      list[1].createdAt.getTime(),
    );
  });
});
