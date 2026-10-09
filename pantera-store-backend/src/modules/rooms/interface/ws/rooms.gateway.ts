import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import type { Room } from '../../domain/entities/room.entity';
import type { RoomEvents } from '../../domain/ports/room-events.port';
import { RoomResponseDto } from '../http/dto/room.dto';

/**
 * Canal en tiempo real de la lista de salas. Es de SOLO LECTURA para el
 * cliente: no recibe nada, solo emite `room:updated` con la sala ya
 * confirmada en la base. Los datos son los mismos públicos de GET /rooms.
 */
@WebSocketGateway({ namespace: 'rooms', cors: { origin: true } })
export class RoomsGateway implements RoomEvents {
  @WebSocketServer()
  private server?: Server;

  roomChanged(room: Room): void {
    this.server?.emit('room:updated', RoomResponseDto.fromDomain(room));
  }
}
