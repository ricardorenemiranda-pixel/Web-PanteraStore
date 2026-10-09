import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import {
  EntityNotFoundException,
  InvalidDomainStateException,
} from '../../../../shared/domain/exceptions/domain.exception';
import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import { managerOf } from '../../../../shared/infrastructure/typeorm-unit-of-work';
import {
  deltaFor,
  LedgerEntry,
  type NewLedgerEntry,
  validateNewEntry,
} from '../../domain/entities/ledger-entry.entity';
import { Wallet, type WalletKind } from '../../domain/entities/wallet.entity';
import type {
  AppendResult,
  LedgerReconciliation,
  ListEntriesOptions,
  WalletRepository,
} from '../../domain/ports/wallet.repository.port';
import { LedgerEntryOrmEntity } from './orm/ledger-entry.orm-entity';
import { WalletOrmEntity } from './orm/wallet.orm-entity';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

@Injectable()
export class TypeOrmWalletRepository implements WalletRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(WalletOrmEntity)
    private readonly wallets: Repository<WalletOrmEntity>,
    @InjectRepository(LedgerEntryOrmEntity)
    private readonly entries: Repository<LedgerEntryOrmEntity>,
  ) {}

  async findById(id: string): Promise<Wallet | null> {
    const row = await this.wallets.findOne({ where: { id } });
    return row ? this.walletToDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<Wallet | null> {
    const row = await this.wallets.findOne({ where: { userId } });
    return row ? this.walletToDomain(row) : null;
  }

  async getOrCreateForUser(
    userId: string,
    kind: WalletKind = 'user',
    tx?: TransactionContext,
  ): Promise<Wallet> {
    const manager = tx ? managerOf(tx) : this.dataSource.manager;
    const find = () => manager.findOne(WalletOrmEntity, { where: { userId } });

    const existing = await find();
    if (existing) return this.walletToDomain(existing);

    const fresh = Wallet.create({ id: randomUUID(), userId, kind });
    // Si dos pedidos crean a la vez, el UNIQUE(userId) deja pasar solo uno.
    await manager
      .createQueryBuilder()
      .insert()
      .into(WalletOrmEntity)
      .values(this.walletToOrm(fresh))
      .orIgnore()
      .execute();

    const created = await find();
    if (!created) throw new EntityNotFoundException('Wallet', userId);
    return this.walletToDomain(created);
  }

  async append(
    walletId: string,
    draft: NewLedgerEntry,
    tx?: TransactionContext,
  ): Promise<AppendResult> {
    validateNewEntry(draft);
    const delta = deltaFor(draft.type, draft.amountCents, draft.direction);
    // Con `tx` se suma a la transacción del que llama; sin `tx`, abre la suya.
    const inTransaction = <T>(
      work: (manager: EntityManager) => Promise<T>,
    ): Promise<T> =>
      tx ? work(managerOf(tx)) : this.dataSource.transaction(work);

    try {
      return await inTransaction(async (manager) => {
        // Bloquea la fila: dos movimientos de la misma billetera se hacen en fila, nunca a la vez.
        const walletRow = await manager.findOne(WalletOrmEntity, {
          where: { id: walletId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!walletRow) throw new EntityNotFoundException('Wallet', walletId);

        const previous = await manager.findOne(LedgerEntryOrmEntity, {
          where: { idempotencyKey: draft.idempotencyKey },
        });
        if (previous) {
          if (
            previous.walletId !== walletId ||
            previous.type !== draft.type ||
            previous.availableDeltaCents !== delta.availableCents ||
            previous.lockedDeltaCents !== delta.lockedCents
          ) {
            throw new InvalidDomainStateException(
              'Esa clave de idempotencia ya se usó para un movimiento distinto.',
            );
          }
          return {
            entry: this.entryToDomain(previous),
            wallet: this.walletToDomain(walletRow),
            replayed: true,
          };
        }

        const wallet = this.walletToDomain(walletRow);
        wallet.applyDelta(delta);

        const entryRow = manager.create(LedgerEntryOrmEntity, {
          id: randomUUID(),
          walletId,
          type: draft.type,
          availableDeltaCents: delta.availableCents,
          lockedDeltaCents: delta.lockedCents,
          availableAfterCents: wallet.availableCents,
          lockedAfterCents: wallet.lockedCents,
          referenceType: draft.referenceType ?? null,
          referenceId: draft.referenceId ?? null,
          idempotencyKey: draft.idempotencyKey,
          description: draft.description?.trim() || null,
          createdBy: draft.createdBy,
          createdAt: new Date(),
        });
        await manager.insert(LedgerEntryOrmEntity, entryRow);
        await manager.save(WalletOrmEntity, this.walletToOrm(wallet));

        return { entry: this.entryToDomain(entryRow), wallet, replayed: false };
      });
    } catch (error) {
      // 23505 = unique_violation: la misma clave llegó a la vez desde otra billetera.
      if ((error as { code?: string }).code === '23505') {
        throw new InvalidDomainStateException(
          'Esa clave de idempotencia ya fue usada.',
        );
      }
      throw error;
    }
  }

  async listEntries(
    walletId: string,
    options: ListEntriesOptions = {},
  ): Promise<LedgerEntry[]> {
    const take = Math.min(
      Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );
    const rows = await this.entries.find({
      where: {
        walletId,
        ...(options.before ? { createdAt: LessThan(options.before) } : {}),
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      take,
    });
    return rows.map((row) => this.entryToDomain(row));
  }

  async reconcile(walletId: string): Promise<LedgerReconciliation> {
    const wallet = await this.findById(walletId);
    if (!wallet) throw new EntityNotFoundException('Wallet', walletId);

    const sums = await this.entries
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e."availableDeltaCents"), 0)', 'available')
      .addSelect('COALESCE(SUM(e."lockedDeltaCents"), 0)', 'locked')
      .where('e."walletId" = :walletId', { walletId })
      .getRawOne<{ available: string; locked: string }>();

    const ledgerAvailableCents = Number(sums?.available ?? 0);
    const ledgerLockedCents = Number(sums?.locked ?? 0);
    return {
      ok:
        ledgerAvailableCents === wallet.availableCents &&
        ledgerLockedCents === wallet.lockedCents,
      ledgerAvailableCents,
      ledgerLockedCents,
      walletAvailableCents: wallet.availableCents,
      walletLockedCents: wallet.lockedCents,
    };
  }

  private walletToDomain(row: WalletOrmEntity): Wallet {
    return Wallet.restore({
      id: row.id,
      userId: row.userId,
      kind: row.kind,
      currency: 'PEN',
      availableCents: row.availableCents,
      lockedCents: row.lockedCents,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private walletToOrm(wallet: Wallet): WalletOrmEntity {
    const row = new WalletOrmEntity();
    row.id = wallet.id;
    row.userId = wallet.userId;
    row.kind = wallet.kind;
    row.currency = wallet.currency;
    row.availableCents = wallet.availableCents;
    row.lockedCents = wallet.lockedCents;
    row.createdAt = wallet.createdAt;
    row.updatedAt = wallet.updatedAt;
    return row;
  }

  private entryToDomain(row: LedgerEntryOrmEntity): LedgerEntry {
    return LedgerEntry.restore({
      id: row.id,
      walletId: row.walletId,
      type: row.type,
      availableDeltaCents: row.availableDeltaCents,
      lockedDeltaCents: row.lockedDeltaCents,
      availableAfterCents: row.availableAfterCents,
      lockedAfterCents: row.lockedAfterCents,
      referenceType: row.referenceType ?? undefined,
      referenceId: row.referenceId ?? undefined,
      idempotencyKey: row.idempotencyKey,
      description: row.description ?? undefined,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    });
  }
}
