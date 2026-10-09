import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import type { Match, MatchStatus } from '../entities/match.entity';

export const MATCH_REPOSITORY = Symbol('MATCH_REPOSITORY');

export interface MatchRepository {
  findById(id: string, tx?: TransactionContext): Promise<Match | null>;
  /** La partida más reciente de la sala. */
  findByRoomId(roomId: string): Promise<Match | null>;
  /** La partida viva (lobby abierto o en juego) de la sala, si hay. */
  findActiveByRoomId(roomId: string): Promise<Match | null>;
  /** Partidas con resultado cuya sala sigue "jugando": falta liquidarlas (recuperación tras un fallo). */
  findFinishedUnsettled(limit?: number): Promise<Match[]>;
  /** Partidas ya cerradas (terminadas, anuladas o fallidas) en las que jugó este usuario, de la más nueva a la más vieja. */
  findClosedOfUser(userId: string, limit?: number): Promise<Match[]>;
  /** Partidas con lobby abierto o en juego: las que el orquestador tiene que vigilar. */
  findActive(): Promise<Match[]>;
  findAll(statuses?: readonly MatchStatus[], limit?: number): Promise<Match[]>;
  save(match: Match, tx?: TransactionContext): Promise<void>;
}
