import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../../config/configuration';
import {
  EntityNotFoundException,
  ForbiddenActionException,
  InvalidDomainStateException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { SuspensionGate } from '../../../../shared/trust/suspension-gate';
import { USER_REPOSITORY, type UserRepository } from '../../../auth/domain/ports/user.repository.port';
import { ChatMessage } from '../../domain/entities/chat-message.entity';
import { CHAT_REPOSITORY, type ChatRepository } from '../../domain/ports/chat.repository.port';

/**
 * Límite de mensajes por usuario en una ventana de tiempo, en memoria. Vive
 * solo mientras el proceso está vivo y solo sirve para UNA instancia del
 * backend — suficiente para el tamaño actual del sitio, pero si el backend
 * llega a correr en varias instancias a la vez esto hay que moverlo a Redis.
 */
class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  allow(userId: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (this.hits.get(userId) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.hits.set(userId, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(userId, recent);
    return true;
  }
}

/** Envía un mensaje al chat general. Bloquea a usuarios suspendidos y aplica un límite de frecuencia simple. */
@Injectable()
export class SendChatMessageUseCase {
  private readonly limiter = new RateLimiter();

  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chat: ChatRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly suspensionGate: SuspensionGate,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async execute(userId: string, body: string): Promise<ChatMessage> {
    const user = await this.users.findById(userId);
    if (!user) throw new EntityNotFoundException('Usuario', userId);

    const suspension = await this.suspensionGate.activeSuspensionOf(userId);
    if (suspension) {
      throw new ForbiddenActionException('Tu cuenta está suspendida y no puede usar el chat mientras dure la suspensión.');
    }

    const { rateLimit, rateLimitWindowSec, maxLength } = this.config.get('chat', { infer: true });
    if (!this.limiter.allow(userId, rateLimit, rateLimitWindowSec * 1000)) {
      throw new InvalidDomainStateException('Estás enviando mensajes muy rápido. Espera un momento.');
    }

    const message = ChatMessage.create(
      { id: randomUUID(), userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, body },
      maxLength,
    );
    await this.chat.save(message);
    return message;
  }
}
