import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { ChatMessage } from '../../../domain/entities/chat-message.entity';

export class ChatHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ChatMessageResponseDto {
  id!: string;
  userId!: string;
  displayName!: string;
  avatarUrl!: string | null;
  body!: string;
  createdAt!: string;

  static fromDomain(m: ChatMessage): ChatMessageResponseDto {
    return {
      id: m.id,
      userId: m.userId,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl ?? null,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
