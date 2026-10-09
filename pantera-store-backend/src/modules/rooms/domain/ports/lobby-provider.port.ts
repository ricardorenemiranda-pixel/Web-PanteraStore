import type { MatchProviderKind, MatchTeam } from '../entities/match.entity';
import type { RoomMode } from '../entities/room.entity';

export const LOBBY_PROVIDER = Symbol('LOBBY_PROVIDER');

export interface LobbyConfig {
  name: string;
  password: string;
  mode: RoomMode;
  /** Quién tiene derecho a estar en el lobby y en qué equipo. */
  participants: { steamId: string; team: MatchTeam }[];
}

export interface LobbyRef {
  id: string;
}

/** Foto del lobby en un momento dado. */
export interface LobbySnapshot {
  state: 'setup' | 'running' | 'postgame' | 'closed';
  /** SteamID64 de todas las cuentas que están dentro (incluye intrusos: el orquestador los expulsa). */
  presentSteamIds: string[];
  dotaMatchId?: string;
  /**
   * SOLO si el proveedor pudo confirmar el ganador con datos oficiales.
   * 'unknown' = terminó pero no hay resultado confiable → lo decide un admin.
   */
  outcome?: MatchTeam | 'unknown';
  /** Cuentas que abandonaron la partida (si el proveedor lo detecta). */
  abandonedSteamIds?: string[];
}

/**
 * El "bot": lo único que sabe hablar con el juego. El resto del sistema
 * depende de esta interfaz, no de Steam, así que el bot real (cuando exista)
 * se enchufa acá sin tocar reglas ni dinero.
 */
export interface LobbyProvider {
  readonly kind: MatchProviderKind;
  /** Devuelve null cuando no hay automatización (modo manual): los jugadores se organizan por fuera. */
  openLobby(config: LobbyConfig): Promise<LobbyRef | null>;
  /** null = el lobby ya no existe o no se puede leer. */
  snapshot(ref: LobbyRef): Promise<LobbySnapshot | null>;
  launch(ref: LobbyRef): Promise<void>;
  kick(ref: LobbyRef, steamId: string): Promise<void>;
  close(ref: LobbyRef): Promise<void>;
}
