import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import type { Room, RoomMode, RoomStatus } from '../entities/room.entity';

export const ROOM_REPOSITORY = Symbol('ROOM_REPOSITORY');

export interface ListRoomsFilter {
  statuses?: readonly RoomStatus[];
  mode?: RoomMode;
  limit?: number;
}

export interface RoomRepository {
  findAll(filter?: ListRoomsFilter): Promise<Room[]>;
  findById(id: string): Promise<Room | null>;
  /**
   * Lee la sala BLOQUEÁNDOLA hasta que termine la transacción: dos jugadores
   * que entran a la vez se atienden en fila, así nunca se pasa el cupo.
   */
  findByIdForUpdate(id: string, tx: TransactionContext): Promise<Room | null>;
  /** Guarda la sala y sincroniza su lista de jugadores (altas y bajas). */
  save(room: Room, tx?: TransactionContext): Promise<void>;
  /** En cuántas salas vivas (esperando, llena o jugando) está este usuario. */
  countActiveRoomsOfUser(
    userId: string,
    tx?: TransactionContext,
  ): Promise<number>;
}
