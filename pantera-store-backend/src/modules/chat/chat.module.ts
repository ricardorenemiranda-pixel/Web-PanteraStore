import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ListChatHistoryUseCase } from './application/use-cases/list-chat-history.use-case';
import { SendChatMessageUseCase } from './application/use-cases/send-chat-message.use-case';
import { CHAT_REPOSITORY } from './domain/ports/chat.repository.port';
import { ChatMessageOrmEntity } from './infrastructure/persistence/orm/chat-message.orm-entity';
import { TypeOrmChatRepository } from './infrastructure/persistence/typeorm-chat.repository';
import { ChatController } from './interface/http/chat.controller';
import { ChatGateway } from './interface/ws/chat.gateway';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([ChatMessageOrmEntity])],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    { provide: CHAT_REPOSITORY, useClass: TypeOrmChatRepository },
    SendChatMessageUseCase,
    ListChatHistoryUseCase,
  ],
})
export class ChatModule {}
