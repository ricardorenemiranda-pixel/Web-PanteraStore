import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { SESSION_COOKIE_NAME } from '../../../auth/interface/constants';
import type { RequestUser } from '../../../auth/interface/guards/jwt-auth.guard';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { SendChatMessageUseCase } from '../../application/use-cases/send-chat-message.use-case';
import { ChatMessageResponseDto } from '../http/dto/chat.dto';

/** Saca el valor de una cookie del header crudo del handshake (socket.io no trae cookie-parser). */
function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Chat general del sitio (una sola sala global, no por partida). A
 * diferencia de RoomsGateway (solo lectura), acá el cliente SÍ manda datos
 * ("chat:send"), así que valida sesión en la conexión: sin un JWT válido en
 * la cookie de sesión, el socket se desconecta al instante.
 */
@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server?: Server;

  /** Cuántas pestañas/conexiones tiene cada usuario, para contar PERSONAS en línea, no sockets. */
  private readonly socketsByUser = new Map<string, number>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly sendMessage: SendChatMessageUseCase,
  ) {}

  handleConnection(client: Socket): void {
    const token =
      readCookie(client.handshake.headers.cookie, SESSION_COOKIE_NAME) ??
      (typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : null);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const user = this.jwtService.verify<RequestUser>(token);
      client.data.user = user;
      this.socketsByUser.set(user.userId, (this.socketsByUser.get(user.userId) ?? 0) + 1);
      this.server?.emit('chat:online', this.socketsByUser.size);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user as RequestUser | undefined;
    if (!user) return;
    const remaining = (this.socketsByUser.get(user.userId) ?? 1) - 1;
    if (remaining <= 0) this.socketsByUser.delete(user.userId);
    else this.socketsByUser.set(user.userId, remaining);
    this.server?.emit('chat:online', this.socketsByUser.size);
  }

  @SubscribeMessage('chat:send')
  async onSend(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const user = client.data.user as RequestUser | undefined;
    if (!user) {
      client.disconnect(true);
      return;
    }
    const text = typeof body === 'string' ? body : (body as { body?: unknown })?.body;
    if (typeof text !== 'string') {
      client.emit('chat:error', 'Mensaje inválido.');
      return;
    }
    try {
      const message = await this.sendMessage.execute(user.userId, text);
      this.server?.emit('chat:message', ChatMessageResponseDto.fromDomain(message));
    } catch (err) {
      client.emit('chat:error', err instanceof DomainException ? err.message : 'No se pudo enviar el mensaje.');
    }
  }
}
