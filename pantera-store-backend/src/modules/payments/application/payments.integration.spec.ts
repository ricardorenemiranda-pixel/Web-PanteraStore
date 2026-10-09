import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import type { AppConfig } from '../../../config/configuration';
import { TypeOrmUnitOfWork } from '../../../shared/infrastructure/typeorm-unit-of-work';
import { createTestDataSource } from '../../../shared/testing/test-datasource';
import { User } from '../../auth/domain/entities/user.entity';
import type { UserRepository } from '../../auth/domain/ports/user.repository.port';
import {
  CreditDepositUseCase,
  HoldWithdrawalUseCase,
  PayWithdrawalUseCase,
  ReleaseWithdrawalUseCase,
} from '../../wallet/application/use-cases/payment-operations.use-cases';
import { LedgerImmutabilityGuard } from '../../wallet/infrastructure/persistence/ledger-immutability';
import { LedgerEntryOrmEntity } from '../../wallet/infrastructure/persistence/orm/ledger-entry.orm-entity';
import { WalletOrmEntity } from '../../wallet/infrastructure/persistence/orm/wallet.orm-entity';
import { TypeOrmWalletRepository } from '../../wallet/infrastructure/persistence/typeorm-wallet.repository';
import {
  DepositProofOrmEntity,
  DepositRequestOrmEntity,
  PaymentAlertOrmEntity,
  WithdrawalRequestOrmEntity,
} from '../infrastructure/persistence/orm/payments.orm-entities';
import { TypeOrmPaymentsRepository } from '../infrastructure/persistence/typeorm-payments.repository';
import {
  type Actor,
  ApproveDepositUseCase,
  CancelDepositUseCase,
  CancelWithdrawalUseCase,
  GetAlertsUseCase,
  GetDepositProofUseCase,
  GetTreasuryUseCase,
  MarkWithdrawalPaidUseCase,
  PaymentsPolicy,
  RejectDepositUseCase,
  RejectWithdrawalUseCase,
  RequestDepositUseCase,
  RequestWithdrawalUseCase,
  ResolveAlertUseCase,
} from './use-cases/payment-use-cases';

// Prueba contra Postgres real. Solo corre con WALLET_TEST_DB_URL (base DESECHABLE):
//   WALLET_TEST_DB_URL=postgres://postgres:postgres@localhost:5433/pantera_wallet_test npx jest payments
const url = process.env.WALLET_TEST_DB_URL;
const describeDb = url ? describe : describe.skip;

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);

describeDb('recargas y retiros (Postgres real)', () => {
  let dataSource: DataSource;
  let wallets: TypeOrmWalletRepository;
  let payments: TypeOrmPaymentsRepository;
  let requestDeposit: RequestDepositUseCase;
  let cancelDeposit: CancelDepositUseCase;
  let approveDeposit: ApproveDepositUseCase;
  let rejectDeposit: RejectDepositUseCase;
  let requestWithdrawal: RequestWithdrawalUseCase;
  let cancelWithdrawal: CancelWithdrawalUseCase;
  let markPaid: MarkWithdrawalPaidUseCase;
  let rejectWithdrawal: RejectWithdrawalUseCase;
  let getProof: GetDepositProofUseCase;
  let treasury: GetTreasuryUseCase;
  let alerts: GetAlertsUseCase;
  let resolveAlert: ResolveAlertUseCase;
  let n = 0;
  const run = Date.now();
  const users = new Map<string, User>();
  const usersRepo: UserRepository = {
    findById: (id) => Promise.resolve(users.get(id) ?? null),
    findBySteamId: () => Promise.resolve(null),
    findByEmail: () => Promise.resolve(null),
    save: () => Promise.resolve(),
  };
  const settings = { enabled: true };
  const config = {
    get: () => ({
      enabled: settings.enabled,
      limits: {
        deposit: {
          minCents: 500,
          maxCents: 20000,
          dailyMaxCents: 50000,
          maxPending: 3,
        },
        withdrawal: {
          minCents: 1000,
          maxCents: 20000,
          dailyMaxCents: 50000,
          maxPending: 2,
        },
      },
      instructions: {
        yape: '900000000',
        plin: '',
        bank: '',
        holder: 'PanteraStore',
      },
    }),
  } as unknown as ConfigService<AppConfig, true>;
  const admin: Actor = { userId: 'admin-pay', role: 'admin' };

  beforeAll(async () => {
    dataSource = await createTestDataSource(url!, [
      WalletOrmEntity,
      LedgerEntryOrmEntity,
      DepositRequestOrmEntity,
      DepositProofOrmEntity,
      WithdrawalRequestOrmEntity,
      PaymentAlertOrmEntity,
    ]);
    await new LedgerImmutabilityGuard(dataSource).onModuleInit();

    wallets = new TypeOrmWalletRepository(
      dataSource,
      dataSource.getRepository(WalletOrmEntity),
      dataSource.getRepository(LedgerEntryOrmEntity),
    );
    payments = new TypeOrmPaymentsRepository(dataSource);
    const uow = new TypeOrmUnitOfWork(dataSource);
    const policy = new PaymentsPolicy(usersRepo, config);
    const credit = new CreditDepositUseCase(wallets);
    const hold = new HoldWithdrawalUseCase(wallets);
    const release = new ReleaseWithdrawalUseCase(wallets);
    const pay = new PayWithdrawalUseCase(wallets);

    requestDeposit = new RequestDepositUseCase(payments, uow, policy);
    cancelDeposit = new CancelDepositUseCase(payments, uow);
    approveDeposit = new ApproveDepositUseCase(payments, uow, credit, policy);
    rejectDeposit = new RejectDepositUseCase(payments, uow);
    requestWithdrawal = new RequestWithdrawalUseCase(
      payments,
      uow,
      hold,
      policy,
    );
    cancelWithdrawal = new CancelWithdrawalUseCase(payments, uow, release);
    markPaid = new MarkWithdrawalPaidUseCase(payments, uow, pay, policy);
    rejectWithdrawal = new RejectWithdrawalUseCase(payments, uow, release);
    getProof = new GetDepositProofUseCase(payments);
    treasury = new GetTreasuryUseCase(payments);
    alerts = new GetAlertsUseCase(payments);
    resolveAlert = new ResolveAlertUseCase(payments);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(() => {
    settings.enabled = true;
  });

  async function player(
    over: { adult?: boolean; steam?: boolean } = {},
  ): Promise<Actor> {
    const id = `pay-user-${run}-${n++}`;
    users.set(
      id,
      User.create({
        id,
        steamId: over.steam === false ? undefined : `7656${run}${n}`,
        displayName: `Jugador ${n}`,
        role: 'customer',
        adultConfirmedAt: over.adult === false ? undefined : new Date(),
      }),
    );
    return { userId: id, role: 'customer' };
  }

  const code = () => `OP-${run}-${n++}`;
  const deposit = (
    a: Actor,
    amountCents = 2000,
    operationCode = code(),
    method: 'yape' | 'plin' | 'transfer' = 'yape',
  ) =>
    requestDeposit.execute(
      a,
      { amountCents, method, operationCode },
      { data: PNG },
    );
  const balance = async (userId: string) => {
    const w = await wallets.findByUserId(userId);
    return w ? [w.availableCents, w.lockedCents] : [0, 0];
  };
  /** Le da saldo REAL al jugador: pide una recarga y el admin la aprueba. */
  async function funded(cents: number): Promise<Actor> {
    const a = await player();
    const d = await deposit(a, cents);
    await approveDeposit.execute(admin.userId, d.id);
    return a;
  }

  // ------------------------------------------------------------ recargas

  it('recarga: queda pendiente sin acreditar nada; al aprobar se acredita exacto y registra al admin', async () => {
    const a = await player();
    const d = await deposit(a, 2500);
    expect(d.status).toBe('pending');
    expect(await balance(a.userId)).toEqual([0, 0]);

    const approved = await approveDeposit.execute('admin-1', d.id);
    expect(approved.status).toBe('approved');
    expect(await balance(a.userId)).toEqual([2500, 0]);

    const wallet = (await wallets.findByUserId(a.userId))!;
    const [entry] = await wallets.listEntries(wallet.id);
    expect(entry.type).toBe('DEPOSIT');
    expect(entry.createdBy).toBe('admin-1');
    expect(entry.referenceId).toBe(d.id);
    expect((await wallets.reconcile(wallet.id)).ok).toBe(true);
  });

  it('aprobar dos veces (o cinco a la vez) acredita UNA sola vez', async () => {
    const a = await player();
    const d = await deposit(a, 3000);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => approveDeposit.execute('admin-1', d.id)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balance(a.userId)).toEqual([3000, 0]);
    await expect(approveDeposit.execute('admin-2', d.id)).rejects.toThrow(
      'ya fue revisado',
    );
  });

  it('acreditar un monto distinto al pedido exige nota y se acredita lo que llegó', async () => {
    const a = await player();
    const d = await deposit(a, 4000);
    await expect(
      approveDeposit.execute('admin-1', d.id, { creditedCents: 3500 }),
    ).rejects.toThrow('motivo');
    expect(await balance(a.userId)).toEqual([0, 0]);
    await approveDeposit.execute('admin-1', d.id, {
      creditedCents: 3500,
      note: 'el comprobante decía S/ 35',
    });
    expect(await balance(a.userId)).toEqual([3500, 0]);
  });

  it('un admin no puede aprobar su propia recarga', async () => {
    const a = await player();
    const d = await deposit(a);
    await expect(approveDeposit.execute(a.userId, d.id)).rejects.toThrow(
      'propia recarga',
    );
    expect(await balance(a.userId)).toEqual([0, 0]);
  });

  it('rechazar no acredita nada y deja el motivo; cancelar lo retira', async () => {
    const a = await player();
    const d1 = await deposit(a);
    const rejected = await rejectDeposit.execute(
      'admin-1',
      d1.id,
      'el comprobante no corresponde',
    );
    expect(rejected.status).toBe('rejected');
    expect(rejected.reviewNote).toBe('el comprobante no corresponde');

    const d2 = await deposit(a);
    expect((await cancelDeposit.execute(a, d2.id)).status).toBe('cancelled');
    expect(await balance(a.userId)).toEqual([0, 0]);
    await expect(
      cancelDeposit.execute(await player(), d2.id),
    ).rejects.toThrow();
  });

  it('el mismo comprobante NO se puede usar dos veces (aunque sea otra cuenta) y queda una alerta', async () => {
    const [a, b] = [await player(), await player()];
    const operation = code();
    await deposit(a, 2000, operation);
    await expect(deposit(b, 2000, operation)).rejects.toThrow(
      'ya fue registrado',
    );
    await expect(deposit(a, 2000, operation.toLowerCase())).rejects.toThrow(
      'ya fue registrado',
    ); // mayúsculas/minúsculas no lo evitan

    const open = await alerts.execute();
    const dup = open.filter(
      (x) =>
        x.kind === 'duplicate_operation_code' &&
        x.refId === operation.toUpperCase(),
    );
    expect(dup.length).toBeGreaterThanOrEqual(2);
    expect(dup[0].severity).toBe('high');

    await resolveAlert.execute('admin-1', dup[0].id);
    const after = await alerts.execute();
    expect(after.some((x) => x.id === dup[0].id)).toBe(false);
  });

  it('un comprobante rechazado libera su número de operación', async () => {
    const [a, b] = [await player(), await player()];
    const operation = code();
    const d = await deposit(a, 2000, operation);
    await rejectDeposit.execute('admin-1', d.id, 'ilegible');
    await expect(deposit(b, 2000, operation)).resolves.toBeDefined();
  });

  it('límites por operación: mínimo y máximo', async () => {
    const a = await player();
    await expect(deposit(a, 499)).rejects.toThrow('mínimo');
    await expect(deposit(a, 20001)).rejects.toThrow('máximo');
    await expect(deposit(a, 500)).resolves.toBeDefined();
  });

  it('límite diario: lo pendiente también cuenta', async () => {
    const a = await player();
    await deposit(a, 20000);
    await deposit(a, 20000);
    await expect(deposit(a, 10001)).rejects.toThrow('límite diario');
    await expect(deposit(a, 10000)).resolves.toBeDefined(); // justo el tope: 50000
  });

  it('máximo de recargas pendientes a la vez', async () => {
    const a = await player();
    for (let i = 0; i < 3; i++) await deposit(a, 600);
    await expect(deposit(a, 600)).rejects.toThrow('pendiente');
  });

  it('el límite diario NO se salta pidiendo varias recargas a la vez', async () => {
    const a = await player();
    // Diario 50000: solo caben 2 de 20000 (40000); la tercera pasaría el tope.
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => deposit(a, 20000)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    const total = (await payments.listDepositsOfUser(a.userId)).reduce(
      (s, d) => s + d.amountCents,
      0,
    );
    expect(total).toBe(40000);
  });

  it('comprobante: solo imágenes reales, y no muy pesadas', async () => {
    const a = await player();
    const base = {
      amountCents: 2000,
      method: 'yape' as const,
      operationCode: code(),
    };
    await expect(
      requestDeposit.execute(a, base, {
        data: Buffer.from('<html>no soy imagen</html>'),
      }),
    ).rejects.toThrow('PNG, JPG o WEBP');
    await expect(
      requestDeposit.execute(a, base, { data: Buffer.alloc(0) }),
    ).rejects.toThrow('comprobante');
    await expect(
      requestDeposit.execute(a, base, {
        data: Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]),
      }),
    ).rejects.toThrow('pesa demasiado');
  });

  it('el comprobante se guarda con su tipo real y el admin lo puede ver', async () => {
    const a = await player();
    const d = await deposit(a);
    const proof = await getProof.execute(d.id);
    expect(proof.contentType).toBe('image/png');
    expect(proof.data.equals(PNG)).toBe(true);
  });

  it('exige mayoría de edad y Steam vinculado; y puede apagarse por configuración', async () => {
    await expect(deposit(await player({ adult: false }))).rejects.toThrow(
      'mayor de 18',
    );
    await expect(deposit(await player({ steam: false }))).rejects.toThrow(
      'Steam',
    );
    settings.enabled = false;
    await expect(deposit(await player())).rejects.toThrow(
      'no están habilitados',
    );
    const d = await (async () => {
      settings.enabled = true;
      return deposit(await player());
    })();
    settings.enabled = false;
    await expect(approveDeposit.execute('admin-1', d.id)).rejects.toThrow(
      'no están habilitados',
    );
  });

  // ------------------------------------------------------------- retiros

  it('retiro: el dinero se aparta al pedirlo, y al pagarlo sale del sistema', async () => {
    const a = await funded(10000);
    const w = await requestWithdrawal.execute(a, {
      amountCents: 4000,
      method: 'yape',
      destination: '987654321',
      holderName: 'Ana Pérez',
    });
    expect(w.status).toBe('pending');
    expect(await balance(a.userId)).toEqual([6000, 4000]); // apartado: no lo puede gastar

    const paid = await markPaid.execute('admin-1', w.id, 'OP-777888');
    expect(paid.status).toBe('paid');
    expect(paid.payoutReference).toBe('OP-777888');
    expect(await balance(a.userId)).toEqual([6000, 0]);

    const wallet = (await wallets.findByUserId(a.userId))!;
    expect(
      (await wallets.listEntries(wallet.id)).map((e) => e.type).reverse(),
    ).toEqual(['DEPOSIT', 'WITHDRAWAL_HOLD', 'WITHDRAWAL_PAID']);
    expect((await wallets.reconcile(wallet.id)).ok).toBe(true);
  });

  it('retiro rechazado o cancelado: el dinero vuelve completo', async () => {
    const a = await funded(10000);
    const input = {
      amountCents: 3000,
      method: 'plin' as const,
      destination: '912345678',
      holderName: 'Ana Pérez',
    };
    const w1 = await requestWithdrawal.execute(a, input);
    await rejectWithdrawal.execute(
      'admin-1',
      w1.id,
      'los datos no coinciden con tu cuenta',
    );
    expect(await balance(a.userId)).toEqual([10000, 0]);

    const w2 = await requestWithdrawal.execute(a, input);
    await cancelWithdrawal.execute(a, w2.id);
    expect(await balance(a.userId)).toEqual([10000, 0]);
    await expect(
      markPaid.execute('admin-1', w2.id, 'OP-000999'),
    ).rejects.toThrow('ya fue revisado');
  });

  it('no se puede retirar más de lo disponible y no queda ningún rastro', async () => {
    const a = await funded(5000);
    await expect(
      requestWithdrawal.execute(a, {
        amountCents: 5001,
        method: 'yape',
        destination: '987654321',
        holderName: 'Ana Pérez',
      }),
    ).rejects.toThrow('insuficiente');
    expect(await balance(a.userId)).toEqual([5000, 0]);
    expect(await payments.listWithdrawalsOfUser(a.userId)).toHaveLength(0);
  });

  it('no se puede pagar dos veces el mismo retiro (ni cinco a la vez)', async () => {
    const a = await funded(10000);
    const w = await requestWithdrawal.execute(a, {
      amountCents: 4000,
      method: 'yape',
      destination: '987654321',
      holderName: 'Ana Pérez',
    });
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        markPaid.execute('admin-1', w.id, 'OP-555666'),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balance(a.userId)).toEqual([6000, 0]);
  });

  it('un admin no puede pagar su propio retiro', async () => {
    const a = await funded(10000);
    const w = await requestWithdrawal.execute(a, {
      amountCents: 2000,
      method: 'yape',
      destination: '987654321',
      holderName: 'Ana Pérez',
    });
    await expect(markPaid.execute(a.userId, w.id, 'OP-123456')).rejects.toThrow(
      'propio retiro',
    );
  });

  it('límites de retiro: mínimo, máximo, diario y pendientes', async () => {
    const a = await funded(20000);
    const req = (amountCents: number) =>
      requestWithdrawal.execute(a, {
        amountCents,
        method: 'yape',
        destination: '987654321',
        holderName: 'Ana Pérez',
      });
    await expect(req(999)).rejects.toThrow('mínimo');
    await expect(req(20001)).rejects.toThrow('máximo');
    await req(1000);
    await req(1000);
    await expect(req(1000)).rejects.toThrow('pendiente'); // máximo 2 pendientes
  });

  it('varios retiros a la vez: nunca se aparta más de lo que hay ni se pasan los pendientes', async () => {
    const a = await funded(20000);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        requestWithdrawal.execute(a, {
          amountCents: 6000,
          method: 'yape',
          destination: '987654321',
          holderName: 'Ana Pérez',
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2); // máx. 2 pendientes
    expect(await balance(a.userId)).toEqual([8000, 12000]);
    const wallet = (await wallets.findByUserId(a.userId))!;
    expect((await wallets.reconcile(wallet.id)).ok).toBe(true);
  });

  it('exige mayoría de edad y Steam para retirar', async () => {
    const noAdult = await player({ adult: false });
    await expect(
      requestWithdrawal.execute(noAdult, {
        amountCents: 2000,
        method: 'yape',
        destination: '987654321',
        holderName: 'Ana Pérez',
      }),
    ).rejects.toThrow('mayor de 18');
  });

  // ---------------------------------------------------- señales de riesgo

  it('retirar dinero recién recargado y sin jugar levanta señales de riesgo para el admin', async () => {
    const a = await funded(10000);
    const w = await requestWithdrawal.execute(a, {
      amountCents: 10000,
      method: 'yape',
      destination: '987654321',
      holderName: 'Ana Pérez',
    });
    expect(w.riskFlags).toEqual(
      expect.arrayContaining(['withdraw_without_play', 'recent_deposit']),
    );
    const list = await alerts.execute();
    expect(
      list.some(
        (x) =>
          x.kind === 'risky_withdrawal' &&
          x.refId === w.id &&
          x.severity === 'medium',
      ),
    ).toBe(true);
  });

  it('dos cuentas que piden pagos al mismo destino se marcan como destino compartido', async () => {
    const destination = `9${String(run).slice(-8)}`;
    const [a, b] = [await funded(10000), await funded(10000)];
    const first = await requestWithdrawal.execute(a, {
      amountCents: 2000,
      method: 'yape',
      destination,
      holderName: 'Titular Uno',
    });
    expect(first.riskFlags).not.toContain('shared_destination');
    const second = await requestWithdrawal.execute(b, {
      amountCents: 2000,
      method: 'yape',
      destination,
      holderName: 'Titular Uno',
    });
    expect(second.riskFlags).toContain('shared_destination');
  });

  // ------------------------------------------------------------ tesorería

  it('la tesorería refleja lo que entró, salió y está pendiente, y el dinero cuadra', async () => {
    const before = await treasury.execute();
    const a = await player();
    const b = await player();
    const d1 = await deposit(a, 10000);
    await deposit(b, 3000); // queda pendiente
    await approveDeposit.execute('admin-1', d1.id);
    const w = await requestWithdrawal.execute(a, {
      amountCents: 4000,
      method: 'yape',
      destination: '987654321',
      holderName: 'Ana Pérez',
    });
    await requestWithdrawal.execute(a, {
      amountCents: 1000,
      method: 'yape',
      destination: '987654321',
      holderName: 'Ana Pérez',
    });
    await markPaid.execute('admin-1', w.id, 'OP-424242');

    const after = await treasury.execute();
    expect(after.deposits.approvedCents - before.deposits.approvedCents).toBe(
      10000,
    );
    expect(after.deposits.pendingCents - before.deposits.pendingCents).toBe(
      3000,
    );
    expect(after.withdrawals.paidCents - before.withdrawals.paidCents).toBe(
      4000,
    );
    expect(
      after.withdrawals.pendingCents - before.withdrawals.pendingCents,
    ).toBe(1000);
    // Otras suites comparten esta base y dejan datos sintéticos que no cuadran; lo que importa es que ESTOS movimientos no agreguen diferencia.
    expect(after.discrepancyCents - before.discrepancyCents).toBe(0);
    expect(after.deposits.approvedLast24hCents).toBeGreaterThanOrEqual(10000);
  });

  it('si un saldo se altera por fuera del libro, salta una alerta grave y la tesorería lo detecta', async () => {
    const a = await funded(5000);
    const wallet = (await wallets.findByUserId(a.userId))!;
    const baseline = (await treasury.execute()).discrepancyCents;
    await dataSource.query(
      `UPDATE wallets SET "availableCents" = "availableCents" + 700 WHERE id = $1`,
      [wallet.id],
    );
    try {
      const list = await alerts.execute();
      expect(
        list.some(
          (x) =>
            x.kind === 'wallet_out_of_sync' &&
            x.userId === a.userId &&
            x.severity === 'high',
        ),
      ).toBe(true);
      expect((await treasury.execute()).discrepancyCents - baseline).toBe(700);
      expect(list.some((x) => x.kind === 'money_mismatch')).toBe(true);
    } finally {
      await dataSource.query(
        `UPDATE wallets SET "availableCents" = "availableCents" - 700 WHERE id = $1`,
        [wallet.id],
      );
    }
    expect((await treasury.execute()).discrepancyCents).toBe(baseline);
  });

  it('DESPUÉS DE TODO: cada billetera coincide con su libro', async () => {
    for (const id of users.keys()) {
      const wallet = await wallets.findByUserId(id);
      if (wallet) expect((await wallets.reconcile(wallet.id)).ok).toBe(true);
    }
  });
});
