import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import { managerOf } from '../../../../shared/infrastructure/typeorm-unit-of-work';
import { Settlement } from '../../domain/entities/settlement.entity';
import type { SettlementRepository } from '../../domain/ports/settlement.repository.port';
import { SettlementOrmEntity } from './orm/settlement.orm-entity';

@Injectable()
export class TypeOrmSettlementRepository implements SettlementRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findByMatchId(matchId: string, tx?: TransactionContext): Promise<Settlement | null> {
    const manager = tx ? managerOf(tx) : this.dataSource.manager;
    const row = await manager.findOne(SettlementOrmEntity, { where: { matchId } });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string, tx?: TransactionContext): Promise<Settlement | null> {
    const manager = tx ? managerOf(tx) : this.dataSource.manager;
    const row = await manager.findOne(SettlementOrmEntity, { where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByMatchIds(matchIds: string[]): Promise<Settlement[]> {
    if (matchIds.length === 0) return [];
    const rows = await this.dataSource.manager.find(SettlementOrmEntity, {
      where: { matchId: In(matchIds) },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async save(settlement: Settlement, tx?: TransactionContext): Promise<void> {
    const manager = tx ? managerOf(tx) : this.dataSource.manager;
    const row = new SettlementOrmEntity();
    row.id = settlement.id;
    row.matchId = settlement.matchId;
    row.roomId = settlement.roomId;
    row.entryFeeCents = settlement.entryFeeCents;
    row.playerCount = settlement.playerCount;
    row.prizePoolCents = settlement.prizePoolCents;
    row.prizeEachCents = settlement.prizeEachCents;
    row.platformCents = settlement.platformCents;
    row.payouts = settlement.payouts;
    row.createdAt = settlement.createdAt;
    row.reversedBy = settlement.reversedBy ?? null;
    row.reversedAt = settlement.reversedAt ?? null;
    // save (upsert por PK): la primera vez inserta; al revertir por una disputa, solo
    // cambian reversedBy/reversedAt (los payouts viajan idénticos, nunca se tocan). El
    // UNIQUE en matchId sigue impidiendo que exista una segunda liquidación distinta.
    await manager.save(SettlementOrmEntity, row);
  }

  private toDomain(row: SettlementOrmEntity): Settlement {
    return Settlement.restore({
      id: row.id,
      matchId: row.matchId,
      roomId: row.roomId,
      entryFeeCents: row.entryFeeCents,
      playerCount: row.playerCount,
      prizePoolCents: row.prizePoolCents,
      prizeEachCents: row.prizeEachCents,
      platformCents: row.platformCents,
      payouts: row.payouts,
      createdAt: row.createdAt,
      reversedBy: row.reversedBy ?? undefined,
      reversedAt: row.reversedAt ?? undefined,
    });
  }
}
