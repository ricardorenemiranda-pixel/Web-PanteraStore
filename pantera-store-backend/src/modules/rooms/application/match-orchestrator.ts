import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID } from 'crypto';
import type { AppConfig } from '../../../config/configuration';
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from '../../../shared/application/unit-of-work';
import {
  EntityNotFoundException,
  ForbiddenActionException,
  InvalidDomainStateException,
} from '../../../shared/domain/exceptions/domain.exception';
import {
  Match,
  type MatchParticipant,
  type MatchTeam,
  splitIntoTeams,
} from '../domain/entities/match.entity';
import type { Room } from '../domain/entities/room.entity';
import {
  LOBBY_PROVIDER,
  type LobbyProvider,
} from '../domain/ports/lobby-provider.port';
import {
  MATCH_REPOSITORY,
  type MatchRepository,
} from '../domain/ports/match.repository.port';
import { ROOM_EVENTS, type RoomEvents } from '../domain/ports/room-events.port';
import {
  ROOM_REPOSITORY,
  type RoomRepository,
} from '../domain/ports/room.repository.port';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../auth/domain/ports/user.repository.port';
import { CancelRoomUseCase } from './use-cases/room-use-cases';
import { SettleMatchUseCase } from './use-cases/settlement-use-cases';

/** Sin ambiguos (0/O, 1/I): la clave se lee y se dicta sin errores. */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_OPEN_ATTEMPTS = 5;

export interface MatchView {
  match: Match;
  /** El equipo del que pide (solo si es participante). */
  yourTeam?: MatchTeam;
}

/**
 * Lleva cada partida desde "sala llena" hasta "hay ganador":
 *   sala llena -> abre el lobby -> vigila quién entra (expulsa intrusos) ->
 *   lanza cuando están todos -> lee el resultado. Si nadie llega a tiempo, o
 *   el bot no logra abrir el lobby, cancela la sala y REEMBOLSA a todos.
 *
 * Trabaja revisando el estado cada pocos segundos (no en eventos sueltos):
 * todo lo importante está en la base de datos, así que si el servidor se
 * reinicia retoma exactamente donde quedó. Pensado para UNA sola instancia
 * del backend.
 */
@Injectable()
export class MatchOrchestrator implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchOrchestrator.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;
  private readonly opening = new Set<string>();
  private readonly openAttempts = new Map<string, number>();

  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(MATCH_REPOSITORY) private readonly matches: MatchRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(LOBBY_PROVIDER) private readonly provider: LobbyProvider,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(ROOM_EVENTS) private readonly events: RoomEvents,
    private readonly cancelRoom: CancelRoomUseCase,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly settle: SettleMatchUseCase,
  ) {}

  /** Reloj y azar: las pruebas los reemplazan para controlarlos. */
  clock: () => Date = () => new Date();
  random: () => number = Math.random;

  onModuleInit(): void {
    const seconds = this.config.get('matches', { infer: true }).pollIntervalSec;
    this.logger.log(
      `Proveedor de partidas: ${this.provider.kind} (revisión cada ${seconds}s)`,
    );
    this.timer = setInterval(() => void this.tick(), seconds * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Se llama apenas una sala se llena; si falla, el próximo `tick` lo reintenta. */
  async onRoomFull(room: Room): Promise<void> {
    if (room.status !== 'full') return;
    if (this.opening.has(room.id)) return;
    if (await this.matches.findActiveByRoomId(room.id)) return;

    this.opening.add(room.id);
    try {
      await this.openMatch(room);
      this.openAttempts.delete(room.id);
    } catch (error) {
      await this.handleOpenFailure(room, error);
    } finally {
      this.opening.delete(room.id);
    }
  }

  /**
   * Una pasada de revisión sobre todo lo pendiente. Nunca se pisa a sí misma.
   * `onlyRoomIds` limita la pasada a esas salas (lo usan las pruebas).
   */
  async tick(onlyRoomIds?: readonly string[]): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const inScope = (roomId: string) =>
        !onlyRoomIds || onlyRoomIds.includes(roomId);

      // 1) Salas llenas que todavía no tienen partida (falló al abrir, o el servidor se reinició).
      for (const room of await this.rooms.findAll({ statuses: ['full'] })) {
        if (inScope(room.id)) await this.onRoomFull(room);
      }
      // 2) Partidas con resultado que quedaron sin pagar (falló la liquidación, o el servidor se reinició).
      for (const match of await this.matches.findFinishedUnsettled()) {
        if (inScope(match.roomId)) await this.settleQuietly(match.id);
      }
      // 3) Partidas vivas.
      for (const match of await this.matches.findActive()) {
        if (!inScope(match.roomId)) continue;
        try {
          await this.process(match);
        } catch (error) {
          this.logger.error(
            `Error procesando la partida ${match.id}`,
            error as Error,
          );
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  /** El admin decide el ganador (modo manual, o cuando el bot no pudo confirmarlo). */
  async adminSetResult(matchId: string, outcome: MatchTeam): Promise<Match> {
    const match = await this.matches.findById(matchId);
    if (!match) throw new EntityNotFoundException('Partida', matchId);
    match.finish({ outcome, source: 'admin' });
    await this.matches.save(match);
    await this.closeLobbyQuietly(match);
    await this.settleQuietly(match.id);
    return match;
  }

  async listForAdmin(): Promise<Match[]> {
    return this.matches.findAll(undefined, 100);
  }

  /** Lo que ve un jugador de su partida (con la clave del lobby). Solo participantes y admins. */
  async viewForPlayer(
    roomId: string,
    actor: { userId: string; role: 'customer' | 'admin' },
  ): Promise<MatchView> {
    const match = await this.matches.findByRoomId(roomId);
    if (!match) throw new EntityNotFoundException('Partida de la sala', roomId);
    const participant = match.participantOf(actor.userId);
    if (!participant && actor.role !== 'admin') {
      throw new ForbiddenActionException(
        'Solo los jugadores de esta partida pueden verla.',
      );
    }
    return { match, yourTeam: participant?.team };
  }

  // ---------------------------------------------------------------------------

  private async openMatch(room: Room): Promise<void> {
    const players = room.players;
    const steamIds = new Map<string, string>();
    for (const player of players) {
      const user = await this.users.findById(player.userId);
      if (!user?.steamId) {
        throw new InvalidDomainStateException(
          `El jugador ${player.displayName} no tiene Steam vinculado.`,
        );
      }
      steamIds.set(player.userId, user.steamId);
    }

    const { radiant, dire } = splitIntoTeams(players, this.random);
    const participants: MatchParticipant[] = [
      ...radiant.map((p) => ({
        userId: p.userId,
        steamId: steamIds.get(p.userId)!,
        displayName: p.displayName,
        team: 'radiant' as const,
      })),
      ...dire.map((p) => ({
        userId: p.userId,
        steamId: steamIds.get(p.userId)!,
        displayName: p.displayName,
        team: 'dire' as const,
      })),
    ];

    const lobbyName = `Pantera ${room.id.slice(0, 6).toUpperCase()}`;
    const lobbyPassword = Array.from(
      { length: 6 },
      () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)],
    ).join('');
    const ref = await this.provider.openLobby({
      name: lobbyName,
      password: lobbyPassword,
      mode: room.mode,
      participants: participants.map((p) => ({
        steamId: p.steamId,
        team: p.team,
      })),
    });

    const timeoutMs =
      this.config.get('matches', { infer: true }).joinTimeoutSec * 1000;
    const match = Match.create({
      id: randomUUID(),
      roomId: room.id,
      provider: this.provider.kind,
      participants,
      lobbyRef: ref?.id,
      lobbyName: ref ? lobbyName : undefined,
      lobbyPassword: ref ? lobbyPassword : undefined,
      joinDeadline: ref
        ? new Date(this.clock().getTime() + timeoutMs)
        : undefined,
    });

    // Sin lobby (manual), la partida ya está "en juego": la sala pasa a jugando de una vez.
    if (match.status === 'in_game') {
      await this.startRoomWith(match);
    } else {
      await this.matches.save(match);
      this.events.roomChanged(room);
    }
  }

  private async handleOpenFailure(room: Room, error: unknown): Promise<void> {
    const attempts = (this.openAttempts.get(room.id) ?? 0) + 1;
    this.openAttempts.set(room.id, attempts);
    this.logger.error(
      `No se pudo abrir la partida de la sala ${room.id} (intento ${attempts}/${MAX_OPEN_ATTEMPTS})`,
      error as Error,
    );
    if (attempts < MAX_OPEN_ATTEMPTS) return;

    // Si no hay forma de jugar, el dinero no se queda trabado: se cancela y se reembolsa.
    this.openAttempts.delete(room.id);
    await this.cancelRoomQuietly(room.id);
  }

  private async process(match: Match): Promise<void> {
    if (!match.lobbyRef) return; // manual: solo espera al admin

    if (match.provider !== this.provider.kind) {
      this.logger.warn(
        `La partida ${match.id} es de "${match.provider}" pero el proveedor activo es "${this.provider.kind}"; se ignora.`,
      );
      return;
    }

    const room = await this.rooms.findById(match.roomId);

    if (match.status === 'waiting_players') {
      // La sala cambió mientras se esperaba (alguien salió o se canceló): este lobby ya no sirve.
      if (!room || room.status !== 'full') {
        await this.closeLobbyQuietly(match);
        match.fail('room_changed');
        await this.matches.save(match);
        return;
      }
      await this.processWaiting(match, room);
      return;
    }

    if (match.status === 'in_game') await this.processInGame(match);
  }

  private async processWaiting(match: Match, room: Room): Promise<void> {
    const ref = { id: match.lobbyRef! };
    const snapshot = await this.provider.snapshot(ref);
    if (!snapshot) {
      await this.failAndRefund(match, room, 'lobby_lost');
      return;
    }

    // Cualquier cuenta que no sea de la sala se expulsa.
    for (const steamId of snapshot.presentSteamIds) {
      if (!match.participantBySteamId(steamId)) {
        await this.provider
          .kick(ref, steamId)
          .catch((e: Error) =>
            this.logger.warn(`No se pudo expulsar a ${steamId}: ${e.message}`),
          );
      }
    }

    match.recordPresence(snapshot.presentSteamIds);

    if (match.allPresent) {
      await this.provider.launch(ref);
      match.start();
      await this.startRoomWith(match);
      return;
    }
    if (match.deadlinePassed(this.clock())) {
      await this.failAndRefund(match, room, 'players_no_show');
      return;
    }
    await this.matches.save(match);
  }

  private async processInGame(match: Match): Promise<void> {
    const ref = { id: match.lobbyRef! };
    const snapshot = await this.provider.snapshot(ref);
    if (!snapshot) {
      // El bot perdió el lobby en pleno juego: no se puede adivinar el ganador.
      if (!match.needsReview) {
        match.flagForReview();
        await this.matches.save(match);
      }
      return;
    }

    if (snapshot.state !== 'postgame' && snapshot.state !== 'closed') return;

    if (snapshot.outcome === 'radiant' || snapshot.outcome === 'dire') {
      const abandoned = new Set(snapshot.abandonedSteamIds ?? []);
      match.finish({
        outcome: snapshot.outcome,
        source: 'bot',
        dotaMatchId: snapshot.dotaMatchId,
        abandonedUserIds: match.participants
          .filter((p) => abandoned.has(p.steamId))
          .map((p) => p.userId),
      });
      await this.matches.save(match);
      await this.closeLobbyQuietly(match);
      await this.settleQuietly(match.id);
      return;
    }

    // Terminó pero sin ganador confiable: lo decide un admin.
    if (!match.needsReview) {
      match.flagForReview();
      await this.matches.save(match);
    }
  }

  /**
   * Paga la partida. Si falla, el resultado ya está guardado: el próximo
   * `tick` lo reintenta (la liquidación es idempotente, nunca paga dos veces).
   */
  private async settleQuietly(matchId: string): Promise<void> {
    try {
      await this.settle.execute(matchId);
    } catch (error) {
      this.logger.error(
        `No se pudo liquidar la partida ${matchId}; se reintentará`,
        error as Error,
      );
    }
  }

  /** Guarda la partida ya iniciada y pasa la sala a "jugando", todo en una transacción. */
  private async startRoomWith(match: Match): Promise<void> {
    const room = await this.uow.run(async (tx) => {
      const locked = await this.rooms.findByIdForUpdate(match.roomId, tx);
      if (!locked) throw new EntityNotFoundException('Sala', match.roomId);
      locked.startGame();
      await this.rooms.save(locked, tx);
      await this.matches.save(match, tx);
      return locked;
    });
    this.events.roomChanged(room);
  }

  private async failAndRefund(
    match: Match,
    room: Room,
    reason: string,
  ): Promise<void> {
    await this.closeLobbyQuietly(match);
    await this.cancelRoomQuietly(room.id);
    match.fail(reason);
    await this.matches.save(match);
  }

  private async cancelRoomQuietly(roomId: string): Promise<void> {
    try {
      await this.cancelRoom.executeAsSystem(roomId);
    } catch (error) {
      // Si ya estaba cancelada (o cambió de estado) no hay nada más que devolver.
      if (!(error instanceof InvalidDomainStateException)) throw error;
    }
  }

  private async closeLobbyQuietly(match: Match): Promise<void> {
    if (!match.lobbyRef) return;
    await this.provider
      .close({ id: match.lobbyRef })
      .catch((e: Error) =>
        this.logger.warn(
          `No se pudo cerrar el lobby ${match.lobbyRef}: ${e.message}`,
        ),
      );
  }
}
