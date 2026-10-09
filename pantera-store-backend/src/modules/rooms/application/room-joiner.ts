import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { TransactionContext } from '../../../shared/application/unit-of-work';
import { InvalidDomainStateException } from '../../../shared/domain/exceptions/domain.exception';
import { LockStakeUseCase } from '../../wallet/application/use-cases/stake-operations.use-cases';
import type { Room } from '../domain/entities/room.entity';
import type { RoomRepository } from '../domain/ports/room.repository.port';

export interface JoiningUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

/**
 * La regla de "entrar a una sala", compartida por crear y unirse: anota al
 * jugador y le bloquea la entrada. Debe correr DENTRO de una transacción con
 * la sala ya bloqueada; si algo falla, el que llama hace rollback de todo.
 */
@Injectable()
export class RoomJoiner {
  constructor(private readonly lockStake: LockStakeUseCase) {}

  async join(
    room: Room,
    user: JoiningUser,
    rooms: RoomRepository,
    tx: TransactionContext,
  ): Promise<void> {
    const joinId = randomUUID();
    // Las reglas de la sala primero (barato, sin tocar plata).
    room.join({
      userId: user.userId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      joinId,
      joinedAt: new Date(),
    });

    // Bloquear la entrada toma el candado de la billetera del jugador: si el
    // mismo jugador intenta entrar a dos salas a la vez, la segunda espera acá
    // y luego ve a la primera ya confirmada.
    await this.lockStake.execute(
      {
        userId: user.userId,
        amountCents: room.entryFeeCents,
        referenceType: 'room',
        referenceId: room.id,
        attempt: joinId,
      },
      tx,
    );

    // Se cuenta ANTES de guardar esta sala: cualquier otra sala viva del
    // jugador es un motivo para rechazar (y el rollback deshace el bloqueo).
    if ((await rooms.countActiveRoomsOfUser(user.userId, tx)) > 0) {
      throw new InvalidDomainStateException(
        'Ya estás en otra sala activa. Sal de ella o espera a que termine para entrar a esta.',
      );
    }
  }
}
