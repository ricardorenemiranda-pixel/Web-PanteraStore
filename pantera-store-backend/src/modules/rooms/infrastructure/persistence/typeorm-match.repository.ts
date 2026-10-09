import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import { managerOf } from '../../../../shared/infrastructure/typeorm-unit-of-work';
import { Match, type MatchStatus } from '../../domain/entities/match.entity';
import type { MatchRepository } from '../../domain/ports/match.repository.port';
import { MatchOrmEntity } from './orm/match.orm-entity';
import { RoomOrmEntity } from './orm/room.orm-entity';

@Injectable()
export class TypeOrmMatchRepository implements MatchRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findById(id: string, tx?: TransactionContext): Promise<Match | null> {
    const manager = tx ? managerOf(tx) : this.dataSource.manager;
    const row = await manager.findOne(MatchOrmEntity, { where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findFinishedUnsettled(limit = 50): Promise<Match[]> {
    const rows = await this.dataSource.manager
      .createQueryBuilder(MatchOrmEntity, 'm')
      .innerJoin(RoomOrmEntity, 'r', 'r.id = m."roomId"')
      .where("m.status = 'finished'")
      .andWhere("r.status = 'playing'")
      .orderBy('m.finishedAt', 'ASC')
      .take(limit)
      .getMany();
    return rows.map((row) => this.toDomain(row));
  }

  async findClosedOfUser(userId: string, limit = 50): Promise<Match[]> {
    const rows = await this.dataSource.manager
      .createQueryBuilder(MatchOrmEntity, 'm')
      .where("m.status IN ('finished', 'voided', 'failed')")
      .andWhere('m.participants @> :who::jsonb', {
        who: JSON.stringify([{ userId }]),
      })
      .orderBy('m.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), 200))
      .getMany();
    return rows.map((row) => this.toDomain(row));
  }

  async findByRoomId(roomId: string): Promise<Match | null> {
    const row = await this.dataSource.manager.findOne(MatchOrmEntity, {
      where: { roomId },
      order: { createdAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  async findActiveByRoomId(roomId: string): Promise<Match | null> {
    const row = await this.dataSource.manager.findOne(MatchOrmEntity, {
      where: { roomId, status: In(['waiting_players', 'in_game']) },
      order: { createdAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  findActive(): Promise<Match[]> {
    return this.findAll(['waiting_players', 'in_game'], 500);
  }

  async findAll(
    statuses?: readonly MatchStatus[],
    limit = 100,
  ): Promise<Match[]> {
    const rows = await this.dataSource.manager.find(MatchOrmEntity, {
      where: statuses ? { status: In([...statuses]) } : {},
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
    return rows.map((row) => this.toDomain(row));
  }

  async save(match: Match, tx?: TransactionContext): Promise<void> {
    const manager = tx ? managerOf(tx) : this.dataSource.manager;
    await manager.save(MatchOrmEntity, this.toOrm(match));
  }

  private toDomain(row: MatchOrmEntity): Match {
    return Match.restore({
      id: row.id,
      roomId: row.roomId,
      status: row.status,
      provider: row.provider,
      participants: row.participants,
      lobbyRef: row.lobbyRef ?? undefined,
      lobbyName: row.lobbyName ?? undefined,
      lobbyPassword: row.lobbyPassword ?? undefined,
      presentSteamIds: row.presentSteamIds,
      joinDeadline: row.joinDeadline ?? undefined,
      dotaMatchId: row.dotaMatchId ?? undefined,
      outcome: row.outcome ?? undefined,
      resultSource: row.resultSource ?? undefined,
      abandonedUserIds: row.abandonedUserIds,
      needsReview: row.needsReview,
      failureReason: row.failureReason ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      finishedAt: row.finishedAt ?? undefined,
    });
  }

  private toOrm(match: Match): MatchOrmEntity {
    const row = new MatchOrmEntity();
    row.id = match.id;
    row.roomId = match.roomId;
    row.status = match.status;
    row.provider = match.provider;
    row.participants = match.participants;
    row.lobbyRef = match.lobbyRef ?? null;
    row.lobbyName = match.lobbyName ?? null;
    row.lobbyPassword = match.lobbyPassword ?? null;
    row.presentSteamIds = match.presentSteamIds;
    row.joinDeadline = match.joinDeadline ?? null;
    row.dotaMatchId = match.dotaMatchId ?? null;
    row.outcome = match.outcome ?? null;
    row.resultSource = match.resultSource ?? null;
    row.abandonedUserIds = match.abandonedUserIds;
    row.needsReview = match.needsReview;
    row.failureReason = match.failureReason ?? null;
    row.createdAt = match.createdAt;
    row.updatedAt = match.updatedAt;
    row.finishedAt = match.finishedAt ?? null;
    return row;
  }
}
