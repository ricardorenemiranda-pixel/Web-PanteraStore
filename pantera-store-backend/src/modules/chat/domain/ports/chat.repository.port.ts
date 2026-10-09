import type { ChatMessage } from '../entities/chat-message.entity';

export const CHAT_REPOSITORY = Symbol('CHAT_REPOSITORY');

export interface ChatRepository {
  save(message: ChatMessage): Promise<void>;
  /** Los últimos mensajes, del más viejo al más nuevo (listos para pintar en orden). */
  listRecent(limit: number): Promise<ChatMessage[]>;
}
