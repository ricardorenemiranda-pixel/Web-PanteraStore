import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

export type RoomStatus =
  | 'waiting' // esperando jugadores
  | 'full' // llena: lista para jugar
  | 'playing'
  | 'finished'
  | 'cancelled';

/** Estados en los que la sala sigue "viva" (los jugadores tienen plata comprometida). */
export const ACTIVE_ROOM_STATUSES: readonly RoomStatus[] = [
  'waiting',
  'full',
  'playing',
];
export const FINISHED_ROOM_STATUSES: readonly RoomStatus[] = [
  'finished',
  'cancelled',
];

export type RoomGame = 'dota2';
export type RoomMode = 'captains_mode' | 'all_pick' | 'turbo';
export const ROOM_MODES: readonly RoomMode[] = [
  'captains_mode',
  'all_pick',
  'turbo',
];

export const MIN_CAPACITY = 2;
export const MAX_CAPACITY = 10; // Dota 2: 5 vs 5
export const MIN_ENTRY_FEE_CENTS = 100; // S/ 1
export const MAX_ENTRY_FEE_CENTS = 50_000; // S/ 500

export interface RoomPlayer {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  /** Identifica ESTA participación: entrar, salir y volver a entrar son operaciones distintas de dinero. */
  joinId: string;
  joinedAt: Date;
}

export interface RoomProps {
  id: string;
  name: string;
  game: RoomGame;
  mode: RoomMode;
  capacity: number;
  entryFeeCents: number;
  /** Comisión de la plataforma, congelada al crear la sala. */
  platformFeeCents: number;
  /** Lo que se reparte entre los ganadores, congelado al crear la sala. */
  prizePoolCents: number;
  status: RoomStatus;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  players: RoomPlayer[];
}

export interface CreateRoomInput {
  id: string;
  name: string;
  mode: RoomMode;
  capacity: number;
  entryFeeCents: number;
  /** Porcentaje de comisión de la plataforma (0-50). */
  platformFeePercent: number;
  createdBy: string;
  createdByName: string;
}

/**
 * Una sala: N jugadores pagan la misma entrada y la partida se juega entre
 * ellos. Acá viven SOLO las reglas de la sala; mover plata es trabajo de la
 * billetera (los casos de uso coordinan las dos cosas en una transacción).
 */
export class Room {
  private constructor(private readonly props: RoomProps) {}

  static create(input: CreateRoomInput): Room {
    const name = input.name.trim();
    if (name.length < 3 || name.length > 60) {
      throw new InvalidDomainStateException(
        'El nombre de la sala debe tener entre 3 y 60 caracteres.',
      );
    }
    if (!ROOM_MODES.includes(input.mode)) {
      throw new InvalidDomainStateException('Modo de juego no válido.');
    }
    if (
      !Number.isInteger(input.capacity) ||
      input.capacity < MIN_CAPACITY ||
      input.capacity > MAX_CAPACITY ||
      input.capacity % 2 !== 0
    ) {
      throw new InvalidDomainStateException(
        `Los cupos deben ser un número par entre ${MIN_CAPACITY} y ${MAX_CAPACITY} (dos equipos iguales).`,
      );
    }
    if (
      !Number.isSafeInteger(input.entryFeeCents) ||
      input.entryFeeCents < MIN_ENTRY_FEE_CENTS ||
      input.entryFeeCents > MAX_ENTRY_FEE_CENTS
    ) {
      throw new InvalidDomainStateException(
        `La entrada debe estar entre S/ ${MIN_ENTRY_FEE_CENTS / 100} y S/ ${MAX_ENTRY_FEE_CENTS / 100}.`,
      );
    }

    const totalCents = input.entryFeeCents * input.capacity;
    const platformFeeCents = Math.floor(
      (totalCents * input.platformFeePercent) / 100,
    );
    const now = new Date();
    return new Room({
      id: input.id,
      name,
      game: 'dota2',
      mode: input.mode,
      capacity: input.capacity,
      entryFeeCents: input.entryFeeCents,
      platformFeeCents,
      prizePoolCents: totalCents - platformFeeCents,
      status: 'waiting',
      createdBy: input.createdBy,
      createdByName: input.createdByName,
      createdAt: now,
      updatedAt: now,
      players: [],
    });
  }

  static restore(props: RoomProps): Room {
    return new Room({ ...props, players: [...props.players] });
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get game(): RoomGame {
    return this.props.game;
  }
  get mode(): RoomMode {
    return this.props.mode;
  }
  get capacity(): number {
    return this.props.capacity;
  }
  get entryFeeCents(): number {
    return this.props.entryFeeCents;
  }
  get platformFeeCents(): number {
    return this.props.platformFeeCents;
  }
  get prizePoolCents(): number {
    return this.props.prizePoolCents;
  }
  get status(): RoomStatus {
    return this.props.status;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }
  get createdByName(): string {
    return this.props.createdByName;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get players(): RoomPlayer[] {
    return [...this.props.players];
  }

  hasPlayer(userId: string): boolean {
    return this.props.players.some((p) => p.userId === userId);
  }

  playerOf(userId: string): RoomPlayer | undefined {
    return this.props.players.find((p) => p.userId === userId);
  }

  /** Suma un jugador. Al llenarse el último cupo, la sala pasa a "lista para jugar". */
  join(player: RoomPlayer): void {
    if (this.props.status !== 'waiting') {
      throw new InvalidDomainStateException(
        this.props.status === 'full'
          ? 'La sala ya está llena.'
          : 'La sala ya no acepta jugadores.',
      );
    }
    if (this.hasPlayer(player.userId)) {
      throw new InvalidDomainStateException('Ya estás en esta sala.');
    }
    this.props.players.push(player);
    if (this.props.players.length >= this.props.capacity) {
      this.props.status = 'full';
    }
    this.touch();
  }

  /** Saca un jugador y devuelve su participación (para devolverle la entrada). */
  leave(userId: string): RoomPlayer {
    if (this.props.status !== 'waiting' && this.props.status !== 'full') {
      throw new InvalidDomainStateException(
        'No puedes salir de una sala que ya empezó o terminó.',
      );
    }
    if (userId === this.props.createdBy) {
      throw new InvalidDomainStateException(
        'El creador no puede salir de su sala: si ya no quieres jugar, cancélala.',
      );
    }
    const player = this.playerOf(userId);
    if (!player) {
      throw new InvalidDomainStateException('No estás en esta sala.');
    }
    this.props.players = this.props.players.filter((p) => p.userId !== userId);
    this.props.status = 'waiting';
    this.touch();
    return player;
  }

  /** Cancela la sala y devuelve a todos los jugadores, a los que hay que reembolsar. */
  cancel(): RoomPlayer[] {
    if (this.props.status !== 'waiting' && this.props.status !== 'full') {
      throw new InvalidDomainStateException(
        'Solo se puede cancelar una sala que todavía no empezó.',
      );
    }
    const refunds = [...this.props.players];
    this.props.players = [];
    this.props.status = 'cancelled';
    this.touch();
    return refunds;
  }

  /** La partida arrancó: la sala llena pasa a "jugando" y ya no admite salidas ni cancelaciones. */
  startGame(): void {
    if (this.props.status !== 'full') {
      throw new InvalidDomainStateException(
        'Solo una sala llena puede empezar a jugar.',
      );
    }
    this.props.status = 'playing';
    this.touch();
  }

  /** La partida se jugó y se pagó: la sala queda terminada. */
  finish(): void {
    if (this.props.status !== 'playing') {
      throw new InvalidDomainStateException(
        'Solo una sala que está jugando puede terminar.',
      );
    }
    this.props.status = 'finished';
    this.touch();
  }

  /** La partida se anuló (empate, inválida): la sala se cancela y devuelve a todos los jugadores para reembolsarlos. */
  voidGame(): RoomPlayer[] {
    if (this.props.status !== 'playing') {
      throw new InvalidDomainStateException(
        'Solo se puede anular una sala que está jugando.',
      );
    }
    const refunds = [...this.props.players];
    this.props.players = [];
    this.props.status = 'cancelled';
    this.touch();
    return refunds;
  }

  /**
   * Una disputa se aceptó: la sala ya "terminada" (con dinero repartido)
   * vuelve a "cancelada". No devuelve jugadores para reembolsar — a
   * diferencia de `voidGame`, esa reversión de dinero ya la hizo la
   * corrección de la liquidación (ver rooms/application/dispute-correction).
   */
  reverseFinish(): void {
    if (this.props.status !== 'finished') {
      throw new InvalidDomainStateException(
        'Solo se puede revertir por disputa una sala ya terminada.',
      );
    }
    this.props.status = 'cancelled';
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
