import type { ConfigService } from '@nestjs/config';
import { In, type DataSource } from 'typeorm';
import { createTestDataSource } from '../../../../shared/testing/test-datasource';
import type { AppConfig } from '../../../../config/configuration';
import { TypeOrmUnitOfWork } from '../../../../shared/infrastructure/typeorm-unit-of-work';
import type {
  AuditEntry,
  AuditLog,
  AuditLogEntry,
} from '../../../../shared/audit/domain/audit-log.port';
import { User } from '../../../auth/domain/entities/user.entity';
import type { UserRepository } from '../../../auth/domain/ports/user.repository.port';
import { AdjustWalletUseCase } from '../../../wallet/application/use-cases/adjust-wallet.use-case';
import {
  ChargeStakeUseCase,
  CollectPlatformFeeUseCase,
  LockStakeUseCase,
  PayPrizeUseCase,
  ReleaseStakeUseCase,
} from '../../../wallet/application/use-cases/stake-operations.use-cases';
import { LedgerImmutabilityGuard } from '../../../wallet/infrastructure/persistence/ledger-immutability';
import { LedgerEntryOrmEntity } from '../../../wallet/infrastructure/persistence/orm/ledger-entry.orm-entity';
import { WalletOrmEntity } from '../../../wallet/infrastructure/persistence/orm/wallet.orm-entity';
import { TypeOrmWalletRepository } from '../../../wallet/infrastructure/persistence/typeorm-wallet.repository';
import { ManualLobbyProvider } from '../../../rooms/infrastructure/lobby/manual-lobby.provider';
import { MatchOrmEntity } from '../../../rooms/infrastructure/persistence/orm/match.orm-entity';
import { RoomOrmEntity } from '../../../rooms/infrastructure/persistence/orm/room.orm-entity';
import { RoomPlayerOrmEntity } from '../../../rooms/infrastructure/persistence/orm/room-player.orm-entity';
import { SettlementOrmEntity } from '../../../rooms/infrastructure/persistence/orm/settlement.orm-entity';
import { TypeOrmMatchRepository } from '../../../rooms/infrastructure/persistence/typeorm-match.repository';
import { TypeOrmRoomRepository } from '../../../rooms/infrastructure/persistence/typeorm-room.repository';
import { TypeOrmSettlementRepository } from '../../../rooms/infrastructure/persistence/typeorm-settlement.repository';
import { MatchOrchestrator } from '../../../rooms/application/match-orchestrator';
import { RoomJoiner } from '../../../rooms/application/room-joiner';
import {
  type Actor,
  CancelRoomUseCase,
  CreateRoomUseCase,
  GetRoomUseCase,
  JoinRoomUseCase,
} from '../../../rooms/application/use-cases/room-use-cases';
import { SettleMatchUseCase } from '../../../rooms/application/use-cases/settlement-use-cases';
import { ReverseSettlementUseCase } from '../../../rooms/application/use-cases/reverse-settlement.use-case';
import { ReportOrmEntity, ReportEvidenceOrmEntity, SanctionOrmEntity, DisputeOrmEntity, DisputeEvidenceOrmEntity } from '../../infrastructure/persistence/orm/trust.orm-entities';
import { TypeOrmTrustRepository } from '../../infrastructure/persistence/typeorm-trust.repository';
import { ApplySanctionUseCase, IsUserSuspendedUseCase, ListSanctionsUseCase, RevokeSanctionUseCase } from './sanction-use-cases';
import { CreateReportUseCase, ReviewReportUseCase } from './report-use-cases';
import { CreateDisputeUseCase, ResolveDisputeUseCase } from './dispute-use-cases';

// Prueba contra Postgres real. Solo corre con WALLET_TEST_DB_URL (base DESECHABLE):
//   WALLET_TEST_DB_URL=postgres://postgres:postgres@localhost:5433/pantera_wallet_test npx jest trust-use-cases
const allowSuspensionGate = {
  activeSuspensionOf: () => Promise.resolve(null),
} as unknown as import('../../../../shared/trust/suspension-gate').SuspensionGate;

class FakeAuditLog implements AuditLog {
  entries: AuditEntry[] = [];
  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
  async list(): Promise<AuditLogEntry[]> {
    return [];
  }
}
const fakeActivityFeed = {
  record: () => Promise.resolve(),
  list: () => Promise.resolve([]),
} as unknown as import('../../../../shared/activity/domain/activity-feed.port').ActivityFeed;

const url = process.env.WALLET_TEST_DB_URL;
const describeDb = url ? describe : describe.skip;

describeDb('confianza y seguridad: sanciones, reportes y disputas (Postgres real)', () => {
  let dataSource: DataSource;
  let wallets: TypeOrmWalletRepository;
  let rooms: TypeOrmRoomRepository;
  let matches: TypeOrmMatchRepository;
  let settlements: TypeOrmSettlementRepository;
  let trust: TypeOrmTrustRepository;
  let create: CreateRoomUseCase;
  let join: JoinRoomUseCase;
  let get: GetRoomUseCase;
  let orchestrator: MatchOrchestrator;
  let adjustWallet: AdjustWalletUseCase;
  let applySanction: ApplySanctionUseCase;
  let revokeSanction: RevokeSanctionUseCase;
  let listSanctions: ListSanctionsUseCase;
  let isSuspended: IsUserSuspendedUseCase;
  let createReport: CreateReportUseCase;
  let reviewReport: ReviewReportUseCase;
  let createDispute: CreateDisputeUseCase;
  let resolveDispute: ResolveDisputeUseCase;
  let reverseSettlement: ReverseSettlementUseCase;
  let fakeAudit: FakeAuditLog;
  let n = 0;
  const run = Date.now();
  const users = new Map<string, User>();
  const usersRepo: UserRepository = {
    findById: (id) => Promise.resolve(users.get(id) ?? null),
    findBySteamId: () => Promise.resolve(null),
    findByEmail: () => Promise.resolve(null),
    save: () => Promise.resolve(),
  };
  const configFor = (windowHours = 48) =>
    ({
      get: (key: string) =>
        ({
          matches: { provider: 'manual', joinTimeoutSec: 300, pollIntervalSec: 5 },
          rooms: { platformFeePercent: 10 },
          terms: { version: 1 },
          disputes: { windowHours },
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
      ReportOrmEntity,
      ReportEvidenceOrmEntity,
      SanctionOrmEntity,
      DisputeOrmEntity,
      DisputeEvidenceOrmEntity,
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
    trust = new TypeOrmTrustRepository(dataSource);
    fakeAudit = new FakeAuditLog();

    const uow = new TypeOrmUnitOfWork(dataSource);
    const events = { roomChanged: () => undefined };
    const release = new ReleaseStakeUseCase(wallets);
    const joiner = new RoomJoiner(new LockStakeUseCase(wallets));
    const cancel = new CancelRoomUseCase(rooms, uow, events, release);
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

    create = new CreateRoomUseCase(rooms, usersRepo, uow, events, joiner, configFor(), allowSuspensionGate);
    join = new JoinRoomUseCase(rooms, usersRepo, uow, events, joiner, configFor(), allowSuspensionGate);
    get = new GetRoomUseCase(rooms);
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

    adjustWallet = new AdjustWalletUseCase(wallets);
    applySanction = new ApplySanctionUseCase(trust, usersRepo, uow, fakeAudit, fakeActivityFeed, adjustWallet);
    revokeSanction = new RevokeSanctionUseCase(trust, uow, fakeAudit, adjustWallet);
    listSanctions = new ListSanctionsUseCase(trust);
    isSuspended = new IsUserSuspendedUseCase(trust);
    createReport = new CreateReportUseCase(trust, usersRepo);
    reviewReport = new ReviewReportUseCase(trust, fakeAudit);
    reverseSettlement = new ReverseSettlementUseCase(rooms, matches, settlements, uow, events, adjustWallet);
    createDispute = new CreateDisputeUseCase(trust, matches, usersRepo, configFor());
    resolveDispute = new ResolveDisputeUseCase(trust, fakeAudit, reverseSettlement);
  }, 30_000);

  afterAll(async () => {
    await dataSource.destroy();
  });

  async function player(fundsCents = 5000): Promise<Actor> {
    const id = `tr-user-${run}-${n++}`;
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
  /**
   * Muchas suites de prueba corren en paralelo contra la misma base y todas
   * comparten la billetera global 'platform' — comparar su saldo absoluto
   * sería falso positivo/negativo según lo que hagan OTRAS suites al mismo
   * tiempo. En vez de eso, se mide el efecto neto solo de los movimientos
   * que referencian ESTA sala/liquidación (IDs únicos, inmunes al ruido).
   */
  const platformNetFor = async (referenceIds: string[]) => {
    const platformWalletId = (await wallets.findByUserId('platform'))!.id;
    const rows = await dataSource
      .getRepository(LedgerEntryOrmEntity)
      .find({ where: { walletId: platformWalletId, referenceId: In(referenceIds) } });
    return rows.reduce((sum, r) => sum + r.availableDeltaCents, 0);
  };

  /** Una sala llena, jugada y liquidada (2 jugadores, modo manual). */
  async function settledMatch(entryFeeCents = 1000, outcome: 'radiant' | 'dire' = 'radiant') {
    const players = await Promise.all([player(), player()]);
    let room = await create.execute(players[0], {
      name: 'Sala confianza',
      mode: 'turbo',
      capacity: 2,
      entryFeeCents,
    });
    room = await join.execute(players[1], room.id);
    await orchestrator.onRoomFull(room);
    const match = (await matches.findActiveByRoomId(room.id))!;
    await orchestrator.adminSetResult(match.id, outcome);
    return { room, match: (await matches.findById(match.id))!, players };
  }

  describe('sanciones', () => {
    it('una multa descuenta saldo real de inmediato', async () => {
      const u = await player(2000);
      const sanction = await applySanction.execute('admin-x', {
        userId: u.userId,
        type: 'fine',
        reason: 'Abandono repetido en partidas de sala.',
        amountCents: 500,
      });
      expect(sanction.amountCents).toBe(500);
      expect(await balances(u.userId)).toEqual([1500, 0]);
      expect(
        fakeAudit.entries.some((e) => e.action === 'trust.sanction.apply' && e.targetId === sanction.id),
      ).toBe(true);
    });

    it('una multa mayor al saldo disponible se rechaza y no queda registrada', async () => {
      const u = await player(300);
      await expect(
        applySanction.execute('admin-x', {
          userId: u.userId,
          type: 'fine',
          reason: 'Motivo suficientemente largo para la multa.',
          amountCents: 5000,
        }),
      ).rejects.toThrow('insuficiente');
      expect(await balances(u.userId)).toEqual([300, 0]);
      expect(await listSanctions.listOfUser(u.userId)).toEqual([]);
    });

    it('revocar una multa devuelve el dinero; revocar dos veces no duplica el reembolso', async () => {
      const u = await player(2000);
      const sanction = await applySanction.execute('admin-x', {
        userId: u.userId,
        type: 'fine',
        reason: 'Motivo suficientemente largo para la multa.',
        amountCents: 500,
      });
      expect(await balances(u.userId)).toEqual([1500, 0]);

      const revoked = await revokeSanction.execute('admin-y', sanction.id, 'Fue un error de criterio.');
      expect(revoked.isRevoked).toBe(true);
      expect(await balances(u.userId)).toEqual([2000, 0]);

      await expect(revokeSanction.execute('admin-y', sanction.id, 'otra vez')).rejects.toThrow('ya fue revocada');
      expect(await balances(u.userId)).toEqual([2000, 0]);
      expect(
        fakeAudit.entries.some((e) => e.action === 'trust.sanction.revoke' && e.targetId === sanction.id),
      ).toBe(true);
    });

    it('una suspensión bloquea según IsUserSuspendedUseCase y deja de bloquear al revocarse', async () => {
      const u = await player(1000);
      expect(await isSuspended.execute(u.userId)).toBeNull();

      const s = await applySanction.execute('admin-x', {
        userId: u.userId,
        type: 'suspension',
        reason: 'Colusión confirmada con otro jugador.',
      });
      expect((await isSuspended.execute(u.userId))?.id).toBe(s.id);

      await revokeSanction.execute('admin-x', s.id, 'Se revisó y no hubo colusión.');
      expect(await isSuspended.execute(u.userId)).toBeNull();
    });

    it('una suspensión con plazo deja de bloquear sola al vencer', async () => {
      const u = await player(1000);
      const until = new Date(Date.now() + 200);
      await applySanction.execute('admin-x', {
        userId: u.userId,
        type: 'suspension',
        reason: 'Abandono intencional de partidas pagas.',
        suspendedUntil: until,
      });
      expect(await isSuspended.execute(u.userId)).not.toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(await isSuspended.execute(u.userId)).toBeNull();
    });

    it('una advertencia no mueve dinero', async () => {
      const u = await player(1000);
      await applySanction.execute('admin-x', {
        userId: u.userId,
        type: 'warning',
        reason: 'Lenguaje inapropiado en el chat de la sala.',
      });
      expect(await balances(u.userId)).toEqual([1000, 0]);
    });
  });

  describe('reportes', () => {
    it('resolver un reporte referencia la sanción aplicada; descartar no sanciona', async () => {
      const reporter = await player(1000);
      const reported = await player(1000);
      const report = await createReport.execute(reporter.userId, {
        reportedUserId: reported.userId,
        category: 'toxic_chat',
        description: 'Insultos constantes durante toda la partida.',
      });
      const sanction = await applySanction.execute('admin-x', {
        userId: reported.userId,
        type: 'warning',
        reason: 'Primera advertencia por lenguaje tóxico.',
        reportId: report.id,
      });
      const resolved = await reviewReport.resolve('admin-x', report.id, 'Se aplicó advertencia.', sanction.id);
      expect(resolved.status).toBe('resolved');
      expect(resolved.sanctionId).toBe(sanction.id);

      const report2 = await createReport.execute(reporter.userId, {
        reportedUserId: reported.userId,
        category: 'griefing',
        description: 'Bloqueo intencional de recursos del equipo.',
      });
      const dismissed = await reviewReport.dismiss('admin-x', report2.id, 'No hay evidencia suficiente.');
      expect(dismissed.status).toBe('dismissed');
      expect(dismissed.sanctionId).toBeUndefined();
    });

    it('un reporte ya revisado no se puede volver a revisar', async () => {
      const reporter = await player(1000);
      const reported = await player(1000);
      const report = await createReport.execute(reporter.userId, {
        reportedUserId: reported.userId,
        category: 'cheating',
        description: 'Uso evidente de script de auto-aim.',
      });
      await reviewReport.dismiss('admin-x', report.id, 'nota');
      await expect(reviewReport.resolve('admin-x', report.id, 'otra vez')).rejects.toThrow('ya fue revisado');
    });

    it('nadie puede reportarse a sí mismo', async () => {
      const u = await player(1000);
      await expect(
        createReport.execute(u.userId, {
          reportedUserId: u.userId,
          category: 'other',
          description: 'Intento de autoreporte de prueba.',
        }),
      ).rejects.toThrow('reportarte a ti mismo');
    });
  });

  describe('disputas', () => {
    it('solo un jugador de la partida puede impugnarla', async () => {
      const { match } = await settledMatch();
      const stranger = await player(100);
      await expect(
        createDispute.execute(stranger.userId, {
          matchId: match.id,
          reason: 'Reclamo de alguien ajeno a la partida.',
        }),
      ).rejects.toThrow('Solo un jugador');
    });

    it('no se puede impugnar una partida que todavía no terminó', async () => {
      const [owner, guest] = await Promise.all([player(2000), player(2000)]);
      let room = await create.execute(owner, {
        name: 'Sala en juego',
        mode: 'turbo',
        capacity: 2,
        entryFeeCents: 500,
      });
      room = await join.execute(guest, room.id);
      await orchestrator.onRoomFull(room);
      const m = (await matches.findActiveByRoomId(room.id))!;
      await expect(
        createDispute.execute(owner.userId, { matchId: m.id, reason: 'Reclamo sobre partida en curso.' }),
      ).rejects.toThrow('ya terminada');
    });

    it('una partida no puede tener dos disputas', async () => {
      const { match, players } = await settledMatch();
      await createDispute.execute(players[0].userId, {
        matchId: match.id,
        reason: 'Primer reclamo sobre el resultado de la partida.',
      });
      await expect(
        createDispute.execute(players[1].userId, {
          matchId: match.id,
          reason: 'Segundo reclamo sobre la misma partida.',
        }),
      ).rejects.toThrow('ya tiene una disputa');
    });

    it('fuera del plazo de impugnación ya no se puede disputar', async () => {
      const shortWindow = new CreateDisputeUseCase(trust, matches, usersRepo, configFor(1));
      const { match, players } = await settledMatch();
      await dataSource
        .getRepository(MatchOrmEntity)
        .update({ id: match.id }, { finishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) });
      await expect(
        shortWindow.execute(players[0].userId, { matchId: match.id, reason: 'Reclamo ya fuera de plazo.' }),
      ).rejects.toThrow('plazo');
    });

    it('uphold revierte TODO el pago: entradas devueltas, premio retirado, comisión devuelta', async () => {
      const { room, match, players } = await settledMatch(1000, 'radiant');
      const settlementBefore = (await settlements.findByMatchId(match.id))!;
      expect(settlementBefore.platformCents).toBeGreaterThan(0);

      const dispute = await createDispute.execute(players[1].userId, {
        matchId: match.id,
        reason: 'El equipo rival usó trampas confirmadas por captura.',
      });
      const resolved = await resolveDispute.uphold('admin-x', dispute.id, 'Se confirmó la denuncia.');
      expect(resolved.status).toBe('upheld');

      for (const p of players) expect(await balances(p.userId)).toEqual([5000, 0]);
      // Comisión cobrada (+) y su reversión (-) se cancelan exactamente: la plataforma no se queda con nada.
      expect(await platformNetFor([room.id, settlementBefore.id])).toBe(0);

      const votedMatch = (await matches.findById(match.id))!;
      expect(votedMatch.status).toBe('voided');
      expect((await get.execute(room.id)).status).toBe('cancelled');
      const reversed = (await settlements.findByMatchId(match.id))!;
      expect(reversed.isReversed).toBe(true);
      expect(
        fakeAudit.entries.some((e) => e.action === 'trust.dispute.uphold' && e.targetId === dispute.id),
      ).toBe(true);
    });

    it('el guard de la disputa impide un segundo uphold, y ReverseSettlementUseCase es idempotente si se reintenta directo', async () => {
      const { match, players } = await settledMatch(1000, 'radiant');
      const dispute = await createDispute.execute(players[1].userId, {
        matchId: match.id,
        reason: 'Reclamo válido con evidencia suficiente aportada.',
      });
      await resolveDispute.uphold('admin-x', dispute.id, 'Aceptado.');
      const afterFirst = await Promise.all(players.map((p) => balances(p.userId)));

      // La disputa ya resuelta bloquea un segundo uphold por su propio guard de dominio.
      await expect(resolveDispute.uphold('admin-x', dispute.id, 'reintento')).rejects.toThrow('ya fue resuelta');

      // Y aunque se invoque la reversión de nuevo directamente (saltándose ese guard),
      // no vuelve a mover dinero: la liquidación ya estaba marcada como revertida.
      await reverseSettlement.execute(match.id, 'admin-x', 'reintento directo');
      expect(await Promise.all(players.map((p) => balances(p.userId)))).toEqual(afterFirst);
    });

    it('reject deja todo igual: no se mueve dinero y el resultado se mantiene', async () => {
      const { room, match, players } = await settledMatch(1000, 'dire');
      const before = await Promise.all(players.map((p) => balances(p.userId)));
      const settlement = (await settlements.findByMatchId(match.id))!;
      const platformFeeBefore = await platformNetFor([room.id, settlement.id]);

      const dispute = await createDispute.execute(players[0].userId, {
        matchId: match.id,
        reason: 'No estoy de acuerdo pero no tengo evidencia clara.',
      });
      const resolved = await resolveDispute.reject('admin-x', dispute.id, 'Sin evidencia suficiente.');
      expect(resolved.status).toBe('rejected');

      expect(await Promise.all(players.map((p) => balances(p.userId)))).toEqual(before);
      // Nada nuevo referencia esta sala/liquidación: la comisión original queda intacta, sin reversión.
      expect(await platformNetFor([room.id, settlement.id])).toBe(platformFeeBefore);
      const m = (await matches.findById(match.id))!;
      expect(m.status).toBe('finished');
      expect(
        fakeAudit.entries.some((e) => e.action === 'trust.dispute.reject' && e.targetId === dispute.id),
      ).toBe(true);
    });
  });

  it('DESPUÉS DE TODO: el libro de cada billetera coincide con su saldo', async () => {
    for (const id of [...users.keys(), 'platform']) {
      const wallet = await wallets.findByUserId(id);
      if (wallet) expect((await wallets.reconcile(wallet.id)).ok).toBe(true);
    }
  });
});
