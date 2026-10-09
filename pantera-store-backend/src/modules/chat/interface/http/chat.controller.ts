import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import { ListChatHistoryUseCase } from '../../application/use-cases/list-chat-history.use-case';
import { ChatHistoryQueryDto, ChatMessageResponseDto } from './dto/chat.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly listHistory: ListChatHistoryUseCase) {}

  /** Los últimos mensajes del chat general, para pintar antes de que lleguen los nuevos por WebSocket. */
  @Get('history')
  async history(@Query() query: ChatHistoryQueryDto) {
    const messages = await this.listHistory.execute(query.limit);
    return messages.map(ChatMessageResponseDto.fromDomain);
  }
}
