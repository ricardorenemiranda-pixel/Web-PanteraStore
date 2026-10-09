import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { AppConfig } from '../../../../config/configuration';
import {
  type TransactionContext,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '../../../../shared/application/unit-of-work';
import {
  EntityNotFoundException,
  ForbiddenActionException,
  InvalidDomainStateException,
} from '../../../../shared/domain/exceptions/domain.exception';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../auth/domain/ports/user.repository.port';
import { ReleaseStakeUseCase } from '../../../wallet/application/use-cases/stake-operations.use-cases';
import { SuspensionGate } from '../../../../shared/trust/suspension-gate';
import {
  ACTIVE_ROOM_STATUSES,
  FINISHED_ROOM_STATUSES,
  Room,
  type RoomMode,
  type RoomPlayer,
} from '../../domain/entities/room.entity';
import {
  ROOM_EVENTS,
  type RoomEvents,
} from '../../domain/ports/room-events.port';
import {
  ROOM_REPOSITORY,
  type RoomRepository,
} from '../../domain/ports/room.repository.port';
import { RoomJoiner } from '../room-joiner';

/** Quién hace la acción. `steamId` ausente = todavía no vinculó Steam. */
export interface Actor {
  userId: string;
  steamId?: string;
  role: 'customer' | 'admin';
}

async function joiningUser(
  users: UserRepository,
  suspensionGate: SuspensionGate,
  termsVersion: number,
  actor: Actor,
) {
  if (!actor.steamId) {
    throw new InvalidDomainStateException(
      'Vincula tu cuenta de Steam para jugar en las salas.',
    );
  }
  const user = await users.findById(actor.userId);
  if (!user) throw new EntityNotFoundException('Usuario', actor.userId);
  if (!user.isAdult()) {
    throw new InvalidDomainStateException(
      'Confirma que eres mayor de 18 años para jugar en las salas.',
    );
  }
  if (!user.hasAcceptedTerms(termsVersion)) {
    throw new InvalidDomainStateException(
      'Acepta los Términos de Servicio para jugar en las salas.',
    );
  }
  const suspension = await suspensionGate.activeSuspensionOf(actor.userId);
  if (suspension) {
    const until = suspension.suspendedUntil
      ? ` hasta el ${suspension.suspendedUntil.toLocaleDateString('es-PE')}`
      : ' de forma indefinida';
    throw new ForbiddenActionException(
      `Tu cuenta está suspendida${until} (motivo: ${suspension.reason}). No puedes jugar en salas mientras dure la suspensión.`,
    );
  }
  return {
    userId: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

@Injectable()
export class ListRoomsUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
  ) {}

  execute(
    view: 'active' | 'finished' | 'all' = 'active',
    mode?: RoomMode,
    limit?: number,
  ): Promise<Room[]> {
    const statuses =
      view === 'active'
        ? ACTIVE_ROOM_STATUSES
        : view === 'finished'
          ? FINISHED_ROOM_STATUSES
          : undefined;
    return this.rooms.findAll({ statuses, mode, limit });
  }
}

@Injectable()
export class GetRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
  ) {}

  async execute(id: string): Promise<Room> {
    const room = await this.rooms.findById(id);
    if (!room) throw new EntityNotFoundException('Sala', id);
    return room;
  }
}

export interface CreateRoomInput {
  name: string;
  mode: RoomMode;
  capacity: number;
  entryFeeCents: number;
}

/** Crea la sala y mete al creador (bloqueándole la entrada) en una sola transacción. */
@Injectable()
export class CreateRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(ROOM_EVENTS) private readonly events: RoomEvents,
    private readonly joiner: RoomJoiner,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly suspensionGate: SuspensionGate,
  ) {}

  async execute(actor: Actor, input: CreateRoomInput): Promise<Room> {
    const creator = await joiningUser(
      this.users,
      this.suspensionGate,
      this.config.get('terms', { infer: true }).version,
      actor,
    );
    const room = Room.create({
      id: randomUUID(),
      ...input,
      platformFeePercent: this.config.get('rooms', { infer: true })
        .platformFeePercent,
      createdBy: creator.userId,
      createdByName: creator.displayName,
    });

    await this.uow.run(async (tx) => {
      await this.joiner.join(room, creator, this.rooms, tx);
      await this.rooms.save(room, tx);
    });

    this.events.roomChanged(room);
    return room;
  }
}

@Injectable()
export class JoinRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(ROOM_EVENTS) private readonly events: RoomEvents,
    private readonly joiner: RoomJoiner,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly suspensionGate: SuspensionGate,
  ) {}

  async execute(actor: Actor, roomId: string): Promise<Room> {
    const user = await joiningUser(
      this.users,
      this.suspensionGate,
      this.config.get('terms', { infer: true }).version,
      actor,
    );

    const room = await this.uow.run(async (tx) => {
      // Sala bloqueada: los que entran a la vez se atienden en fila.
      const locked = await this.rooms.findByIdForUpdate(roomId, tx);
      if (!locked) throw new EntityNotFoundException('Sala', roomId);
      await this.joiner.join(locked, user, this.rooms, tx);
      await this.rooms.save(locked, tx);
      return locked;
    });

    this.events.roomChanged(room);
    return room;
  }
}

@Injectable()
export class LeaveRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(ROOM_EVENTS) private readonly events: RoomEvents,
    private readonly releaseStake: ReleaseStakeUseCase,
  ) {}

  async execute(actor: Actor, roomId: string): Promise<Room> {
    const room = await this.uow.run(async (tx) => {
      const locked = await this.rooms.findByIdForUpdate(roomId, tx);
      if (!locked) throw new EntityNotFoundException('Sala', roomId);
      const player = locked.leave(actor.userId);
      await this.refund(locked, player, tx);
      await this.rooms.save(locked, tx);
      return locked;
    });

    this.events.roomChanged(room);
    return room;
  }

  private refund(room: Room, player: RoomPlayer, tx: TransactionContext) {
    return this.releaseStake.execute(
      {
        userId: player.userId,
        amountCents: room.entryFeeCents,
        referenceType: 'room',
        referenceId: room.id,
        attempt: player.joinId,
      },
      tx,
    );
  }
}

/** Cancela la sala y reembolsa a TODOS sus jugadores, en la misma transacción. */
@Injectable()
export class CancelRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(ROOM_EVENTS) private readonly events: RoomEvents,
    private readonly releaseStake: ReleaseStakeUseCase,
  ) {}

  async execute(actor: Actor, roomId: string): Promise<Room> {
    return this.cancel(roomId, (room) => {
      if (actor.role !== 'admin' && room.createdBy !== actor.userId) {
        throw new ForbiddenActionException(
          'Solo el creador de la sala o un administrador pueden cancelarla.',
        );
      }
    });
  }

  /** Cancelación decidida por el sistema (ej. nadie llegó al lobby): sin chequeo de permisos. */
  executeAsSystem(roomId: string): Promise<Room> {
    return this.cancel(roomId);
  }

  private async cancel(
    roomId: string,
    authorize?: (room: Room) => void,
  ): Promise<Room> {
    const room = await this.uow.run(async (tx) => {
      const locked = await this.rooms.findByIdForUpdate(roomId, tx);
      if (!locked) throw new EntityNotFoundException('Sala', roomId);
      authorize?.(locked);

      const refunds = locked.cancel();
      // Siempre en el mismo orden (por usuario): evita bloqueos cruzados entre salas.
      for (const player of [...refunds].sort((a, b) =>
        a.userId.localeCompare(b.userId),
      )) {
        await this.releaseStake.execute(
          {
            userId: player.userId,
            amountCents: locked.entryFeeCents,
            referenceType: 'room',
            referenceId: locked.id,
            attempt: player.joinId,
          },
          tx,
        );
      }
      await this.rooms.save(locked, tx);
      return locked;
    });

    this.events.roomChanged(room);
    return room;
  }
}
