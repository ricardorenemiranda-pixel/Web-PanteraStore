import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import { managerOf } from '../../../../shared/infrastructure/typeorm-unit-of-work';
import {
  DepositRequest,
  type DepositStatus,
} from '../../domain/entities/deposit-request.entity';
import {
  WithdrawalRequest,
  type WithdrawalStatus,
} from '../../domain/entities/withdrawal-request.entity';
import {
  DuplicateOperationCodeException,
  type LifetimeTotals,
  type PaymentAlert,
  type PaymentsRepository,
  type ProofFile,
  type TreasurySnapshot,
  type WalletOutOfSync,
} from '../../domain/ports/payments.repository.port';
import {
  DepositProofOrmEntity,
  DepositRequestOrmEntity,
  PaymentAlertOrmEntity,
  WithdrawalRequestOrmEntity,
} from './orm/payments.orm-entities';

const UNIQUE_VIOLATION = '23505';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

const clamp = (limit: number | undefined) =>
  Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
const num = (value: unknown): number => Number(value ?? 0);

@Injectable()
export class TypeOrmPaymentsRepository implements PaymentsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private mgr(tx?: TransactionContext): EntityManager {
    return tx ? managerOf(tx) : this.dataSource.manager;
  }

  async lockUser(userId: string, tx: TransactionContext): Promise<void> {
    await managerOf(tx).query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `payments:${userId}`,
    ]);
  }

  // ----------------------------------------------------------------- Recargas

  async insertDeposit(
    deposit: DepositRequest,
    proof: ProofFile,
    tx: TransactionContext,
  ): Promise<void> {
    const manager = managerOf(tx);
    try {
      await manager.insert(DepositRequestOrmEntity, this.depositToOrm(deposit));
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION)
        throw new DuplicateOperationCodeException();
      throw error;
    }
    await manager.insert(DepositProofOrmEntity, {
      depositId: deposit.id,
      contentType: proof.contentType,
      data: proof.data,
    });
  }

  async saveDeposit(
    deposit: DepositRequest,
    tx?: TransactionContext,
  ): Promise<void> {
    await this.mgr(tx).save(
      DepositRequestOrmEntity,
      this.depositToOrm(deposit),
    );
  }

  async findDeposit(
    id: string,
    tx?: TransactionContext,
  ): Promise<DepositRequest | null> {
    const row = await this.mgr(tx).findOne(DepositRequestOrmEntity, {
      where: { id },
    });
    return row ? this.depositToDomain(row) : null;
  }

  async findDepositForUpdate(
    id: string,
    tx: TransactionContext,
  ): Promise<DepositRequest | null> {
    const row = await managerOf(tx).findOne(DepositRequestOrmEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return row ? this.depositToDomain(row) : null;
  }

  async listDepositsOfUser(
    userId: string,
    limit?: number,
  ): Promise<DepositRequest[]> {
    const rows = await this.dataSource.manager.find(DepositRequestOrmEntity, {
      where: { userId },
      order: { createdAt: 'DESC' },
      take: clamp(limit),
    });
    return rows.map((r) => this.depositToDomain(r));
  }

  async listDeposits(
    statuses?: readonly DepositStatus[],
    limit?: number,
  ): Promise<DepositRequest[]> {
    const rows = await this.dataSource.manager.find(DepositRequestOrmEntity, {
      where: statuses ? { status: In([...statuses]) } : {},
      order: { createdAt: 'DESC' },
      take: clamp(limit),
    });
    return rows.map((r) => this.depositToDomain(r));
  }

  async getProof(depositId: string): Promise<ProofFile | null> {
    const row = await this.dataSource.manager.findOne(DepositProofOrmEntity, {
      where: { depositId },
    });
    return row ? { contentType: row.contentType, data: row.data } : null;
  }

  async sumDepositsSince(
    userId: string,
    since: Date,
    tx: TransactionContext,
  ): Promise<number> {
    const row = await managerOf(tx)
      .createQueryBuilder(DepositRequestOrmEntity, 'd')
      .select('COALESCE(SUM(d."amountCents"), 0)', 'sum')
      .where('d."userId" = :userId', { userId })
      .andWhere(`d.status IN ('pending', 'approved')`)
      .andWhere('d."createdAt" >= :since', { since })
      .getRawOne<{ sum: string }>();
    return num(row?.sum);
  }

  countDepositsSince(
    userId: string,
    since: Date,
    tx: TransactionContext,
  ): Promise<number> {
    return this.countSince(DepositRequestOrmEntity, userId, since, tx);
  }

  countPendingDeposits(
    userId: string,
    tx: TransactionContext,
  ): Promise<number> {
    return managerOf(tx).count(DepositRequestOrmEntity, {
      where: { userId, status: 'pending' },
    });
  }

  async countRejectedDepositsSince(
    userId: string,
    since: Date,
    tx: TransactionContext,
  ): Promise<number> {
    return managerOf(tx)
      .createQueryBuilder(DepositRequestOrmEntity, 'd')
      .where('d."userId" = :userId', { userId })
      .andWhere(`d.status = 'rejected'`)
      .andWhere('d."createdAt" >= :since', { since })
      .getCount();
  }

  // ------------------------------------------------------------------ Retiros

  async insertWithdrawal(
    withdrawal: WithdrawalRequest,
    tx: TransactionContext,
  ): Promise<void> {
    await managerOf(tx).insert(
      WithdrawalRequestOrmEntity,
      this.withdrawalToOrm(withdrawal),
    );
  }

  async saveWithdrawal(
    withdrawal: WithdrawalRequest,
    tx?: TransactionContext,
  ): Promise<void> {
    await this.mgr(tx).save(
      WithdrawalRequestOrmEntity,
      this.withdrawalToOrm(withdrawal),
    );
  }

  async findWithdrawal(
    id: string,
    tx?: TransactionContext,
  ): Promise<WithdrawalRequest | null> {
    const row = await this.mgr(tx).findOne(WithdrawalRequestOrmEntity, {
      where: { id },
    });
    return row ? this.withdrawalToDomain(row) : null;
  }

  async findWithdrawalForUpdate(
    id: string,
    tx: TransactionContext,
  ): Promise<WithdrawalRequest | null> {
    const row = await managerOf(tx).findOne(WithdrawalRequestOrmEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return row ? this.withdrawalToDomain(row) : null;
  }

  async listWithdrawalsOfUser(
    userId: string,
    limit?: number,
  ): Promise<WithdrawalRequest[]> {
    const rows = await this.dataSource.manager.find(
      WithdrawalRequestOrmEntity,
      {
        where: { userId },
        order: { createdAt: 'DESC' },
        take: clamp(limit),
      },
    );
    return rows.map((r) => this.withdrawalToDomain(r));
  }

  async listWithdrawals(
    statuses?: readonly WithdrawalStatus[],
    limit?: number,
  ): Promise<WithdrawalRequest[]> {
    const rows = await this.dataSource.manager.find(
      WithdrawalRequestOrmEntity,
      {
        where: statuses ? { status: In([...statuses]) } : {},
        order: { createdAt: 'DESC' },
        take: clamp(limit),
      },
    );
    return rows.map((r) => this.withdrawalToDomain(r));
  }

  async sumWithdrawalsSince(
    userId: string,
    since: Date,
    tx: TransactionContext,
  ): Promise<number> {
    const row = await managerOf(tx)
      .createQueryBuilder(WithdrawalRequestOrmEntity, 'w')
      .select('COALESCE(SUM(w."amountCents"), 0)', 'sum')
      .where('w."userId" = :userId', { userId })
      .andWhere(`w.status IN ('pending', 'paid')`)
      .andWhere('w."createdAt" >= :since', { since })
      .getRawOne<{ sum: string }>();
    return num(row?.sum);
  }

  countWithdrawalsSince(
    userId: string,
    since: Date,
    tx: TransactionContext,
  ): Promise<number> {
    return this.countSince(WithdrawalRequestOrmEntity, userId, since, tx);
  }

  countPendingWithdrawals(
    userId: string,
    tx: TransactionContext,
  ): Promise<number> {
    return managerOf(tx).count(WithdrawalRequestOrmEntity, {
      where: { userId, status: 'pending' },
    });
  }

  async countOtherUsersWithDestination(
    userId: string,
    destination: string,
    tx: TransactionContext,
  ): Promise<number> {
    const row = await managerOf(tx)
      .createQueryBuilder(WithdrawalRequestOrmEntity, 'w')
      .select('COUNT(DISTINCT w."userId")', 'count')
      .where('w.destination = :destination', { destination })
      .andWhere('w."userId" <> :userId', { userId })
      .andWhere(`w.status IN ('pending', 'paid')`)
      .getRawOne<{ count: string }>();
    return num(row?.count);
  }

  private async countSince(
    entity: typeof DepositRequestOrmEntity | typeof WithdrawalRequestOrmEntity,
    userId: string,
    since: Date,
    tx: TransactionContext,
  ): Promise<number> {
    return managerOf(tx)
      .createQueryBuilder(entity, 'r')
      .where('r."userId" = :userId', { userId })
      .andWhere('r."createdAt" >= :since', { since })
      .getCount();
  }

  // ----------------------------------------------------- Historial de la cuenta

  async lifetimeTotals(
    userId: string,
    tx: TransactionContext,
  ): Promise<LifetimeTotals> {
    const manager = managerOf(tx);
    const deposits = await manager
      .createQueryBuilder(DepositRequestOrmEntity, 'd')
      .select('COALESCE(SUM(d."creditedCents"), 0)', 'sum')
      .addSelect('MAX(d."reviewedAt")', 'last')
      .where('d."userId" = :userId', { userId })
      .andWhere(`d.status = 'approved'`)
      .getRawOne<{ sum: string; last: Date | null }>();

    // "Jugado" = entradas cobradas de sus salas (el libro de su billetera, movimientos STAKE_CHARGE).
    const played = await manager.query(
      `SELECT COALESCE(SUM(-e."lockedDeltaCents"), 0) AS sum
         FROM wallet_ledger_entries e
         JOIN wallets w ON w.id = e."walletId"
        WHERE w."userId" = $1 AND e.type = 'STAKE_CHARGE'`,
      [userId],
    );
    return {
      depositedCents: num(deposits?.sum),
      playedCents: num(played?.[0]?.sum),
      lastDepositAt: deposits?.last ? new Date(deposits.last) : null,
    };
  }

  // ---------------------------------------------------------- Alertas y tesorería

  async saveAlert(alert: PaymentAlert): Promise<void> {
    await this.dataSource.manager.save(PaymentAlertOrmEntity, {
      id: alert.id,
      kind: alert.kind,
      userId: alert.userId ?? null,
      refId: alert.refId ?? null,
      message: alert.message,
      createdAt: alert.createdAt,
      resolvedAt: alert.resolvedAt ?? null,
      resolvedBy: alert.resolvedBy ?? null,
    });
  }

  async listOpenAlerts(): Promise<PaymentAlert[]> {
    const rows = await this.dataSource.manager
      .createQueryBuilder(PaymentAlertOrmEntity, 'a')
      .where('a."resolvedAt" IS NULL')
      .orderBy('a.createdAt', 'DESC')
      .take(100)
      .getMany();
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      userId: r.userId ?? undefined,
      refId: r.refId ?? undefined,
      message: r.message,
      createdAt: r.createdAt,
    }));
  }

  async resolveAlert(id: string, adminId: string): Promise<boolean> {
    const result = await this.dataSource.manager
      .createQueryBuilder()
      .update(PaymentAlertOrmEntity)
      .set({ resolvedAt: new Date(), resolvedBy: adminId })
      .where('id = :id AND "resolvedAt" IS NULL', { id })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async treasury(): Promise<TreasurySnapshot> {
    // Todo se lee de UN mismo instante (REPEATABLE READ): si un movimiento se confirma
    // justo en medio, no puede aparecer una "diferencia" que en realidad no existe.
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const dep = await m.query(
        `SELECT status, COUNT(*)::int AS count,
                COALESCE(SUM(CASE WHEN status = 'approved' THEN "creditedCents" ELSE "amountCents" END), 0) AS cents
           FROM deposit_requests GROUP BY status`,
      );
      const wd = await m.query(
        `SELECT status, COUNT(*)::int AS count, COALESCE(SUM("amountCents"), 0) AS cents
           FROM withdrawal_requests GROUP BY status`,
      );
      const wallets = await m.query(
        `SELECT kind, COALESCE(SUM("availableCents"), 0) AS available, COALESCE(SUM("lockedCents"), 0) AS locked
           FROM wallets GROUP BY kind`,
      );
      // Solo estos movimientos meten o sacan dinero del sistema; todos los demás
      // (entradas de sala, premios, comisiones, retiros apartados) solo lo mueven de lugar.
      const ledger = await m.query(
        `SELECT
           COALESCE(SUM(CASE WHEN type IN ('DEPOSIT', 'ADJUSTMENT', 'WITHDRAWAL', 'WITHDRAWAL_PAID')
                             THEN "availableDeltaCents" + "lockedDeltaCents" ELSE 0 END), 0) AS net,
           COALESCE(SUM(CASE WHEN type = 'ADJUSTMENT' THEN "availableDeltaCents" ELSE 0 END), 0) AS adjustments
         FROM wallet_ledger_entries`,
      );
      const day = await m.query(
        `SELECT
           (SELECT COALESCE(SUM("creditedCents"), 0) FROM deposit_requests
              WHERE status = 'approved' AND "reviewedAt" >= now() - interval '24 hours') AS deposits24,
           (SELECT COALESCE(SUM("amountCents"), 0) FROM withdrawal_requests
              WHERE status = 'paid' AND "reviewedAt" >= now() - interval '24 hours') AS withdrawals24`,
      );

      const by = (
        rows: { status: string; count: number; cents: string }[],
        status: string,
      ) => rows.find((r) => r.status === status);
      const playersRow = wallets.find(
        (w: { kind: string }) => w.kind === 'user',
      );
      const platformRow = wallets.find(
        (w: { kind: string }) => w.kind === 'platform',
      );
      const playersAvailable = num(playersRow?.available);
      const playersLocked = num(playersRow?.locked);
      const platform = num(platformRow?.available) + num(platformRow?.locked);

      return {
        deposits: {
          approvedCents: num(by(dep, 'approved')?.cents),
          approvedCount: num(by(dep, 'approved')?.count),
          pendingCents: num(by(dep, 'pending')?.cents),
          pendingCount: num(by(dep, 'pending')?.count),
          rejectedCount: num(by(dep, 'rejected')?.count),
          approvedLast24hCents: num(day[0]?.deposits24),
        },
        withdrawals: {
          paidCents: num(by(wd, 'paid')?.cents),
          paidCount: num(by(wd, 'paid')?.count),
          pendingCents: num(by(wd, 'pending')?.cents),
          pendingCount: num(by(wd, 'pending')?.count),
          rejectedCount: num(by(wd, 'rejected')?.count),
          paidLast24hCents: num(day[0]?.withdrawals24),
        },
        wallets: {
          playersCents: playersAvailable + playersLocked,
          playersAvailableCents: playersAvailable,
          playersLockedCents: playersLocked,
          platformCents: platform,
        },
        adjustmentsNetCents: num(ledger[0]?.adjustments),
        discrepancyCents:
          playersAvailable + playersLocked + platform - num(ledger[0]?.net),
      };
    });
  }

  async walletsOutOfSync(limit = 100): Promise<WalletOutOfSync[]> {
    const rows = await this.dataSource.manager.query(
      `SELECT w.id AS "walletId", w."userId",
              w."availableCents" AS wa, w."lockedCents" AS wl,
              COALESCE(SUM(e."availableDeltaCents"), 0) AS la,
              COALESCE(SUM(e."lockedDeltaCents"), 0) AS ll
         FROM wallets w
         LEFT JOIN wallet_ledger_entries e ON e."walletId" = w.id
        GROUP BY w.id
       HAVING w."availableCents" <> COALESCE(SUM(e."availableDeltaCents"), 0)
           OR w."lockedCents" <> COALESCE(SUM(e."lockedDeltaCents"), 0)
        LIMIT $1`,
      [limit],
    );
    return rows.map(
      (r: {
        walletId: string;
        userId: string;
        wa: string;
        wl: string;
        la: string;
        ll: string;
      }) => ({
        walletId: r.walletId,
        userId: r.userId,
        walletAvailableCents: num(r.wa),
        walletLockedCents: num(r.wl),
        ledgerAvailableCents: num(r.la),
        ledgerLockedCents: num(r.ll),
      }),
    );
  }

  // ------------------------------------------------------------------ mapeos

  private depositToOrm(d: DepositRequest): DepositRequestOrmEntity {
    const row = new DepositRequestOrmEntity();
    row.id = d.id;
    row.userId = d.userId;
    row.userDisplayName = d.userDisplayName;
    row.amountCents = d.amountCents;
    row.method = d.method;
    row.operationCode = d.operationCode;
    row.proofContentType = d.proofContentType;
    row.status = d.status;
    row.riskFlags = d.riskFlags;
    row.reviewedBy = d.reviewedBy ?? null;
    row.reviewedAt = d.reviewedAt ?? null;
    row.reviewNote = d.reviewNote ?? null;
    row.creditedCents = d.creditedCents ?? null;
    row.createdAt = d.createdAt;
    row.updatedAt = d.updatedAt;
    return row;
  }

  private depositToDomain(row: DepositRequestOrmEntity): DepositRequest {
    return DepositRequest.restore({
      id: row.id,
      userId: row.userId,
      userDisplayName: row.userDisplayName,
      amountCents: row.amountCents,
      method: row.method,
      operationCode: row.operationCode,
      proofContentType: row.proofContentType,
      status: row.status,
      riskFlags: row.riskFlags,
      reviewedBy: row.reviewedBy ?? undefined,
      reviewedAt: row.reviewedAt ?? undefined,
      reviewNote: row.reviewNote ?? undefined,
      creditedCents: row.creditedCents ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private withdrawalToOrm(w: WithdrawalRequest): WithdrawalRequestOrmEntity {
    const row = new WithdrawalRequestOrmEntity();
    row.id = w.id;
    row.userId = w.userId;
    row.userDisplayName = w.userDisplayName;
    row.amountCents = w.amountCents;
    row.method = w.method;
    row.destination = w.destination;
    row.holderName = w.holderName;
    row.status = w.status;
    row.riskFlags = w.riskFlags;
    row.reviewedBy = w.reviewedBy ?? null;
    row.reviewedAt = w.reviewedAt ?? null;
    row.reviewNote = w.reviewNote ?? null;
    row.payoutReference = w.payoutReference ?? null;
    row.createdAt = w.createdAt;
    row.updatedAt = w.updatedAt;
    return row;
  }

  private withdrawalToDomain(
    row: WithdrawalRequestOrmEntity,
  ): WithdrawalRequest {
    return WithdrawalRequest.restore({
      id: row.id,
      userId: row.userId,
      userDisplayName: row.userDisplayName,
      amountCents: row.amountCents,
      method: row.method,
      destination: row.destination,
      holderName: row.holderName,
      status: row.status,
      riskFlags: row.riskFlags,
      reviewedBy: row.reviewedBy ?? undefined,
      reviewedAt: row.reviewedAt ?? undefined,
      reviewNote: row.reviewNote ?? undefined,
      payoutReference: row.payoutReference ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
