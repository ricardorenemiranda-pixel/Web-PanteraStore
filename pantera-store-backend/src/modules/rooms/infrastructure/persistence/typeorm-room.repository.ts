import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import { managerOf } from '../../../../shared/infrastructure/typeorm-unit-of-work';
import {
  ACTIVE_ROOM_STATUSES,
  Room,
  type RoomPlayer,
} from '../../domain/entities/room.entity';
import type {
  ListRoomsFilter,
  RoomRepository,
} from '../../domain/ports/room.repository.port';
import { RoomOrmEntity } from './orm/room.orm-entity';
import { RoomPlayerOrmEntity } from './orm/room-player.orm-entity';

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 200;

@Injectable()
export class TypeOrmRoomRepository implements RoomRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private managerFor(tx?: TransactionContext): EntityManager {
    return tx ? managerOf(tx) : this.dataSource.manager;
  }

  async findAll(filter: ListRoomsFilter = {}): Promise<Room[]> {
    const take = Math.min(
      Math.max(filter.limit ?? DEFAULT_LIST_LIMIT, 1),
      MAX_LIST_LIMIT,
    );
    const rows = await this.dataSource.manager.find(RoomOrmEntity, {
      where: {
        ...(filter.statuses ? { status: In([...filter.statuses]) } : {}),
        ...(filter.mode ? { mode: filter.mode } : {}),
      },
      order: { createdAt: 'DESC' },
      take,
    });
    if (rows.length === 0) return [];

    const playerRows = await this.dataSource.manager.find(RoomPlayerOrmEntity, {
      where: { roomId: In(rows.map((r) => r.id)) },
      order: { joinedAt: 'ASC' },
    });
    return rows.map((row) =>
      this.toDomain(
        row,
        playerRows.filter((p) => p.roomId === row.id),
      ),
    );
  }

  async findById(id: string): Promise<Room | null> {
    const row = await this.dataSource.manager.findOne(RoomOrmEntity, {
      where: { id },
    });
    if (!row) return null;
    const players = await this.dataSource.manager.find(RoomPlayerOrmEntity, {
      where: { roomId: id },
      order: { joinedAt: 'ASC' },
    });
    return this.toDomain(row, players);
  }

  async findByIdForUpdate(
    id: string,
    tx: TransactionContext,
  ): Promise<Room | null> {
    const manager = managerOf(tx);
    const row = await manager.findOne(RoomOrmEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!row) return null;
    const players = await manager.find(RoomPlayerOrmEntity, {
      where: { roomId: id },
      order: { joinedAt: 'ASC' },
    });
    return this.toDomain(row, players);
  }

  async save(room: Room, tx?: TransactionContext): Promise<void> {
    const write = async (manager: EntityManager) => {
      await manager.save(RoomOrmEntity, this.toOrm(room));

      const current = await manager.find(RoomPlayerOrmEntity, {
        where: { roomId: room.id },
      });
      const wanted = new Map(room.players.map((p) => [p.userId, p]));

      const toRemove = current.filter((row) => !wanted.has(row.userId));
      if (toRemove.length > 0)
        await manager.remove(RoomPlayerOrmEntity, toRemove);

      const existing = new Set(current.map((row) => row.userId));
      const toAdd = room.players
        .filter((p) => !existing.has(p.userId))
        .map((p) => this.playerToOrm(room.id, p));
      if (toAdd.length > 0) await manager.insert(RoomPlayerOrmEntity, toAdd);
    };

    if (tx) await write(managerOf(tx));
    else await this.dataSource.transaction(write);
  }

  async countActiveRoomsOfUser(
    userId: string,
    tx?: TransactionContext,
  ): Promise<number> {
    return this.managerFor(tx)
      .createQueryBuilder(RoomPlayerOrmEntity, 'rp')
      .innerJoin(RoomOrmEntity, 'r', 'r.id = rp."roomId"')
      .where('rp."userId" = :userId', { userId })
      .andWhere('r.status IN (:...statuses)', {
        statuses: [...ACTIVE_ROOM_STATUSES],
      })
      .getCount();
  }

  private toDomain(row: RoomOrmEntity, players: RoomPlayerOrmEntity[]): Room {
    return Room.restore({
      id: row.id,
      name: row.name,
      game: row.game,
      mode: row.mode,
      capacity: row.capacity,
      entryFeeCents: row.entryFeeCents,
      platformFeeCents: row.platformFeeCents,
      prizePoolCents: row.prizePoolCents,
      status: row.status,
      createdBy: row.createdBy,
      createdByName: row.createdByName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      players: players.map((p): RoomPlayer => ({
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl ?? undefined,
        joinId: p.joinId,
        joinedAt: p.joinedAt,
      })),
    });
  }

  private toOrm(room: Room): RoomOrmEntity {
    const row = new RoomOrmEntity();
    row.id = room.id;
    row.name = room.name;
    row.game = room.game;
    row.mode = room.mode;
    row.capacity = room.capacity;
    row.entryFeeCents = room.entryFeeCents;
    row.platformFeeCents = room.platformFeeCents;
    row.prizePoolCents = room.prizePoolCents;
    row.status = room.status;
    row.createdBy = room.createdBy;
    row.createdByName = room.createdByName;
    row.createdAt = room.createdAt;
    row.updatedAt = room.updatedAt;
    return row;
  }

  private playerToOrm(roomId: string, player: RoomPlayer): RoomPlayerOrmEntity {
    const row = new RoomPlayerOrmEntity();
    row.roomId = roomId;
    row.userId = player.userId;
    row.displayName = player.displayName;
    row.avatarUrl = player.avatarUrl ?? null;
    row.joinId = player.joinId;
    row.joinedAt = player.joinedAt;
    return row;
  }
}
