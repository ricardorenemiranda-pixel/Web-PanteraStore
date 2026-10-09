import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

/**
 * waiting_players: el lobby está abierto y falta gente.
 * in_game: se lanzó la partida (o, en modo manual, se está jugando por fuera).
 * finished: hay ganador registrado (el pago lo hace la liquidación, Sprint 4).
 * failed: no se pudo jugar (ej. nadie llegó al lobby a tiempo).
 * voided: se jugó pero se anuló (empate, partida inválida): se reembolsa a todos.
 */
export type MatchStatus =
  'waiting_players' | 'in_game' | 'finished' | 'failed' | 'voided';
export type MatchTeam = 'radiant' | 'dire';
export type MatchProviderKind = 'manual' | 'fake' | 'steam';
export type ResultSource = 'bot' | 'admin';

export interface MatchParticipant {
  userId: string;
  /** SteamID64: con esto el bot reconoce quién entró al lobby. */
  steamId: string;
  displayName: string;
  team: MatchTeam;
}

export interface MatchProps {
  id: string;
  roomId: string;
  status: MatchStatus;
  provider: MatchProviderKind;
  participants: MatchParticipant[];
  /** Identificador del lobby en el proveedor (ausente en modo manual). */
  lobbyRef?: string;
  lobbyName?: string;
  lobbyPassword?: string;
  /** SteamID64 de los participantes que ya están dentro del lobby. */
  presentSteamIds: string[];
  /** Límite para que lleguen todos al lobby. */
  joinDeadline?: Date;
  dotaMatchId?: string;
  outcome?: MatchTeam;
  resultSource?: ResultSource;
  /** Jugadores que abandonaron la partida (detectado por el proveedor). */
  abandonedUserIds: string[];
  /** El proveedor no pudo dar un ganador confiable: un admin tiene que decidir. */
  needsReview: boolean;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
  finishedAt?: Date;
}

export interface CreateMatchInput {
  id: string;
  roomId: string;
  provider: MatchProviderKind;
  participants: MatchParticipant[];
  lobbyRef?: string;
  lobbyName?: string;
  lobbyPassword?: string;
  joinDeadline?: Date;
}

export interface FinishMatchInput {
  outcome: MatchTeam;
  source: ResultSource;
  dotaMatchId?: string;
  abandonedUserIds?: string[];
}

/** Reparte a los jugadores en dos equipos iguales, al azar (la posición de entrada no da ventaja). */
export function splitIntoTeams<T>(
  players: T[],
  random: () => number = Math.random,
): { radiant: T[]; dire: T[] } {
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const half = Math.ceil(shuffled.length / 2);
  return { radiant: shuffled.slice(0, half), dire: shuffled.slice(half) };
}

/**
 * Una partida de Dota 2 jugada por los jugadores de una sala. Guarda quién
 * está en cada equipo, cómo va el lobby y el resultado. NO mueve plata: el
 * pago sale de este resultado en la liquidación (Sprint 4).
 */
export class Match {
  private constructor(private readonly props: MatchProps) {}

  static create(input: CreateMatchInput): Match {
    if (input.participants.length < 2 || input.participants.length % 2 !== 0) {
      throw new InvalidDomainStateException(
        'Una partida necesita un número par de jugadores.',
      );
    }
    const radiant = input.participants.filter(
      (p) => p.team === 'radiant',
    ).length;
    if (radiant * 2 !== input.participants.length) {
      throw new InvalidDomainStateException(
        'Los dos equipos deben tener la misma cantidad de jugadores.',
      );
    }
    const now = new Date();
    // Sin lobby (modo manual) los jugadores se organizan por fuera: ya se está jugando.
    const automated = input.lobbyRef !== undefined;
    return new Match({
      id: input.id,
      roomId: input.roomId,
      status: automated ? 'waiting_players' : 'in_game',
      provider: input.provider,
      participants: input.participants,
      lobbyRef: input.lobbyRef,
      lobbyName: input.lobbyName,
      lobbyPassword: input.lobbyPassword,
      presentSteamIds: [],
      joinDeadline: input.joinDeadline,
      abandonedUserIds: [],
      needsReview: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: MatchProps): Match {
    return new Match({
      ...props,
      participants: [...props.participants],
      presentSteamIds: [...props.presentSteamIds],
      abandonedUserIds: [...props.abandonedUserIds],
    });
  }

  get id(): string {
    return this.props.id;
  }
  get roomId(): string {
    return this.props.roomId;
  }
  get status(): MatchStatus {
    return this.props.status;
  }
  get provider(): MatchProviderKind {
    return this.props.provider;
  }
  get participants(): MatchParticipant[] {
    return [...this.props.participants];
  }
  get lobbyRef(): string | undefined {
    return this.props.lobbyRef;
  }
  get lobbyName(): string | undefined {
    return this.props.lobbyName;
  }
  get lobbyPassword(): string | undefined {
    return this.props.lobbyPassword;
  }
  get presentSteamIds(): string[] {
    return [...this.props.presentSteamIds];
  }
  get joinDeadline(): Date | undefined {
    return this.props.joinDeadline;
  }
  get dotaMatchId(): string | undefined {
    return this.props.dotaMatchId;
  }
  get outcome(): MatchTeam | undefined {
    return this.props.outcome;
  }
  get resultSource(): ResultSource | undefined {
    return this.props.resultSource;
  }
  get abandonedUserIds(): string[] {
    return [...this.props.abandonedUserIds];
  }
  get needsReview(): boolean {
    return this.props.needsReview;
  }
  get failureReason(): string | undefined {
    return this.props.failureReason;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get finishedAt(): Date | undefined {
    return this.props.finishedAt;
  }

  get isActive(): boolean {
    return (
      this.props.status === 'waiting_players' || this.props.status === 'in_game'
    );
  }

  participantBySteamId(steamId: string): MatchParticipant | undefined {
    return this.props.participants.find((p) => p.steamId === steamId);
  }

  participantOf(userId: string): MatchParticipant | undefined {
    return this.props.participants.find((p) => p.userId === userId);
  }

  /** Solo se toman en cuenta los participantes de la sala; cualquier otra cuenta en el lobby se ignora. */
  recordPresence(steamIds: string[]): void {
    const expected = new Set(this.props.participants.map((p) => p.steamId));
    this.props.presentSteamIds = [...new Set(steamIds)].filter((id) =>
      expected.has(id),
    );
    this.touch();
  }

  get allPresent(): boolean {
    return this.props.presentSteamIds.length === this.props.participants.length;
  }

  get missingParticipants(): MatchParticipant[] {
    const present = new Set(this.props.presentSteamIds);
    return this.props.participants.filter((p) => !present.has(p.steamId));
  }

  deadlinePassed(now: Date): boolean {
    return (
      this.props.joinDeadline !== undefined &&
      now.getTime() > this.props.joinDeadline.getTime()
    );
  }

  /** El lobby se lanzó con todos adentro. */
  start(): void {
    if (this.props.status !== 'waiting_players') {
      throw new InvalidDomainStateException(
        'La partida no está esperando jugadores.',
      );
    }
    if (!this.allPresent) {
      throw new InvalidDomainStateException(
        'Faltan jugadores por entrar al lobby.',
      );
    }
    this.props.status = 'in_game';
    this.touch();
  }

  /** Registra al ganador. Una partida terminada no se puede volver a decidir. */
  finish(input: FinishMatchInput): void {
    if (this.props.status !== 'in_game') {
      throw new InvalidDomainStateException(
        this.props.status === 'finished'
          ? 'Esta partida ya tiene un resultado registrado.'
          : 'Solo se puede registrar el resultado de una partida en juego.',
      );
    }
    const now = new Date();
    this.props.status = 'finished';
    this.props.outcome = input.outcome;
    this.props.resultSource = input.source;
    this.props.dotaMatchId = input.dotaMatchId ?? this.props.dotaMatchId;
    this.props.abandonedUserIds = [...(input.abandonedUserIds ?? [])];
    this.props.needsReview = false;
    this.props.finishedAt = now;
    this.props.updatedAt = now;
  }

  /** El proveedor no pudo confirmar un ganador: se marca para que un admin lo resuelva. */
  flagForReview(): void {
    if (this.props.status !== 'in_game') return;
    this.props.needsReview = true;
    this.touch();
  }

  fail(reason: string): void {
    if (this.props.status !== 'waiting_players') {
      throw new InvalidDomainStateException(
        'Solo una partida que espera jugadores puede fallar.',
      );
    }
    const now = new Date();
    this.props.status = 'failed';
    this.props.failureReason = reason;
    this.props.finishedAt = now;
    this.props.updatedAt = now;
  }

  /**
   * Una disputa se aceptó: el resultado ya pagado se anula. Se conserva el
   * `outcome`/`resultSource` originales como historial (para auditar qué se
   * había decidido), pero el estado pasa a `voided` para que nadie se siga
   * mostrando como ganador.
   */
  voidAfterSettlement(reason: string): void {
    if (this.props.status !== 'finished') {
      throw new InvalidDomainStateException(
        'Solo se puede anular por disputa una partida ya terminada.',
      );
    }
    const now = new Date();
    this.props.status = 'voided';
    this.props.failureReason = reason;
    this.props.updatedAt = now;
  }

  /** Una partida en juego que no se puede validar (empate, inválida) se anula. */
  void(reason: string): void {
    if (this.props.status !== 'in_game') {
      throw new InvalidDomainStateException(
        'Solo se puede anular una partida que está en juego.',
      );
    }
    const now = new Date();
    this.props.status = 'voided';
    this.props.failureReason = reason;
    this.props.needsReview = false;
    this.props.finishedAt = now;
    this.props.updatedAt = now;
  }

  /** Los ganadores según el resultado registrado (vacío si todavía no hay). */
  get winners(): MatchParticipant[] {
    return this.props.outcome
      ? this.props.participants.filter((p) => p.team === this.props.outcome)
      : [];
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
