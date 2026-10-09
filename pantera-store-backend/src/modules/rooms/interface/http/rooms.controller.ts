import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MatchOrchestrator } from '../../application/match-orchestrator';
import { CurrentUser } from '../../../auth/interface/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import type { RequestUser } from '../../../auth/interface/guards/jwt-auth.guard';
import {
  CancelRoomUseCase,
  CreateRoomUseCase,
  GetRoomUseCase,
  JoinRoomUseCase,
  LeaveRoomUseCase,
  ListRoomsUseCase,
} from '../../application/use-cases/room-use-cases';
import {
  CreateRoomDto,
  ListRoomsQueryDto,
  RoomResponseDto,
} from './dto/room.dto';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly listRooms: ListRoomsUseCase,
    private readonly getRoom: GetRoomUseCase,
    private readonly createRoom: CreateRoomUseCase,
    private readonly joinRoom: JoinRoomUseCase,
    private readonly leaveRoom: LeaveRoomUseCase,
    private readonly cancelRoom: CancelRoomUseCase,
    private readonly orchestrator: MatchOrchestrator,
  ) {}

  // --- Público: ver salas no requiere cuenta ---

  @Get()
  async list(@Query() query: ListRoomsQueryDto) {
    const rooms = await this.listRooms.execute(
      query.view,
      query.mode,
      query.limit,
    );
    return rooms.map(RoomResponseDto.fromDomain);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return RoomResponseDto.fromDomain(await this.getRoom.execute(id));
  }

  // --- Requiere sesión (y Steam vinculado, lo valida el caso de uso) ---

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateRoomDto) {
    return RoomResponseDto.fromDomain(await this.createRoom.execute(user, dto));
  }

  @Post(':id/join')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async join(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const room = await this.joinRoom.execute(user, id);
    // Si con este jugador la sala se llenó, se abre la partida. Si falla, la revisión periódica lo reintenta.
    void this.orchestrator.onRoomFull(room).catch(() => undefined);
    return RoomResponseDto.fromDomain(room);
  }

  @Post(':id/leave')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async leave(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return RoomResponseDto.fromDomain(await this.leaveRoom.execute(user, id));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async cancel(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return RoomResponseDto.fromDomain(await this.cancelRoom.execute(user, id));
  }
}
