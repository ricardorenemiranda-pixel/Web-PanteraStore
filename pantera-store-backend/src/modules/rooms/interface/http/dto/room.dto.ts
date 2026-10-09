import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  MAX_CAPACITY,
  MAX_ENTRY_FEE_CENTS,
  MIN_CAPACITY,
  MIN_ENTRY_FEE_CENTS,
  ROOM_MODES,
  type Room,
  type RoomGame,
  type RoomMode,
  type RoomStatus,
} from '../../../domain/entities/room.entity';

export class CreateRoomDto {
  @IsString()
  @Length(3, 60)
  name!: string;

  @IsIn(ROOM_MODES as readonly string[])
  mode!: RoomMode;

  @IsInt()
  @Min(MIN_CAPACITY)
  @Max(MAX_CAPACITY)
  capacity!: number;

  /** En céntimos enteros (S/ 11.00 = 1100). */
  @IsInt()
  @Min(MIN_ENTRY_FEE_CENTS)
  @Max(MAX_ENTRY_FEE_CENTS)
  entryFeeCents!: number;
}

export class ListRoomsQueryDto {
  @IsOptional()
  @IsIn(['active', 'finished', 'all'])
  view?: 'active' | 'finished' | 'all';

  @IsOptional()
  @IsIn(ROOM_MODES as readonly string[])
  mode?: RoomMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export interface RoomPlayerResponse {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Lo que se ve públicamente (lista y tiempo real): nada de datos de billetera. */
export class RoomResponseDto {
  id!: string;
  name!: string;
  game!: RoomGame;
  mode!: RoomMode;
  capacity!: number;
  playerCount!: number;
  entryFeeCents!: number;
  prizePoolCents!: number;
  status!: RoomStatus;
  createdBy!: string;
  createdByName!: string;
  createdAt!: string;
  players!: RoomPlayerResponse[];

  static fromDomain(room: Room): RoomResponseDto {
    return {
      id: room.id,
      name: room.name,
      game: room.game,
      mode: room.mode,
      capacity: room.capacity,
      playerCount: room.players.length,
      entryFeeCents: room.entryFeeCents,
      prizePoolCents: room.prizePoolCents,
      status: room.status,
      createdBy: room.createdBy,
      createdByName: room.createdByName,
      createdAt: room.createdAt.toISOString(),
      players: room.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl ?? null,
      })),
    };
  }
}
