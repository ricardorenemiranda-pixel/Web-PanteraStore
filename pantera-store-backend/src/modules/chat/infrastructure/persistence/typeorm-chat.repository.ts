import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChatMessage } from '../../domain/entities/chat-message.entity';
import type { ChatRepository } from '../../domain/ports/chat.repository.port';
import { ChatMessageOrmEntity } from './orm/chat-message.orm-entity';

@Injectable()
export class TypeOrmChatRepository implements ChatRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async save(message: ChatMessage): Promise<void> {
    const row = new ChatMessageOrmEntity();
    row.id = message.id;
    row.userId = message.userId;
    row.displayName = message.displayName;
    row.avatarUrl = message.avatarUrl ?? null;
    row.body = message.body;
    row.createdAt = message.createdAt;
    await this.dataSource.manager.save(ChatMessageOrmEntity, row);
  }

  async listRecent(limit: number): Promise<ChatMessage[]> {
    const rows = await this.dataSource.manager.find(ChatMessageOrmEntity, {
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.reverse().map((r) =>
      ChatMessage.restore({
        id: r.id,
        userId: r.userId,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl ?? undefined,
        body: r.body,
        createdAt: r.createdAt,
      }),
    );
  }
}
