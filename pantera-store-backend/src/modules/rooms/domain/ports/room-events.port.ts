import type { Room } from '../entities/room.entity';

export const ROOM_EVENTS = Symbol('ROOM_EVENTS');

/** Avisa "en vivo" a quien esté mirando la lista. Se llama SIEMPRE después de confirmar la transacción. */
export interface RoomEvents {
  roomChanged(room: Room): void;
}
