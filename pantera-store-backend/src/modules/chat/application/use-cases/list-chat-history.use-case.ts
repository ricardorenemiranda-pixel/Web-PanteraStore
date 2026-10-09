import { Inject, Injectable } from '@nestjs/common';
import { ChatMessage } from '../../domain/entities/chat-message.entity';
import { CHAT_REPOSITORY, type ChatRepository } from '../../domain/ports/chat.repository.port';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ListChatHistoryUseCase {
  constructor(@Inject(CHAT_REPOSITORY) private readonly chat: ChatRepository) {}

  execute(limit?: number): Promise<ChatMessage[]> {
    return this.chat.listRecent(Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT));
  }
}
