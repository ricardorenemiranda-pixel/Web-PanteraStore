import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { MatchTeam } from '../../domain/entities/match.entity';
import type {
  LobbyConfig,
  LobbyProvider,
  LobbyRef,
  LobbySnapshot,
} from '../../domain/ports/lobby-provider.port';

interface FakeLobby {
  config: LobbyConfig;
  state: LobbySnapshot['state'];
  present: Set<string>;
  dotaMatchId?: string;
  outcome?: LobbySnapshot['outcome'];
  abandoned: Set<string>;
  kicked: string[];
}

/**
 * Lobby simulado en memoria: sirve para desarrollar y probar todo el flujo
 * (entradas, no-shows, ganador) sin Steam. Los métodos `simulate*` hacen lo
 * que en la vida real harían los jugadores y el juego.
 */
@Injectable()
export class FakeLobbyProvider implements LobbyProvider {
  readonly kind = 'fake' as const;
  private readonly lobbies = new Map<string, FakeLobby>();

  openLobby(config: LobbyConfig): Promise<LobbyRef | null> {
    const id = randomUUID();
    this.lobbies.set(id, {
      config,
      state: 'setup',
      present: new Set(),
      abandoned: new Set(),
      kicked: [],
    });
    return Promise.resolve({ id });
  }

  snapshot(ref: LobbyRef): Promise<LobbySnapshot | null> {
    const lobby = this.lobbies.get(ref.id);
    if (!lobby) return Promise.resolve(null);
    return Promise.resolve({
      state: lobby.state,
      presentSteamIds: [...lobby.present],
      dotaMatchId: lobby.dotaMatchId,
      outcome: lobby.outcome,
      abandonedSteamIds: [...lobby.abandoned],
    });
  }

  launch(ref: LobbyRef): Promise<void> {
    const lobby = this.require(ref);
    lobby.state = 'running';
    return Promise.resolve();
  }

  kick(ref: LobbyRef, steamId: string): Promise<void> {
    const lobby = this.require(ref);
    lobby.present.delete(steamId);
    lobby.kicked.push(steamId);
    return Promise.resolve();
  }

  close(ref: LobbyRef): Promise<void> {
    const lobby = this.lobbies.get(ref.id);
    if (lobby) lobby.state = 'closed';
    return Promise.resolve();
  }

  // --- Lo que en la vida real hacen los jugadores y el juego ---

  simulateJoin(ref: LobbyRef, steamId: string): void {
    this.require(ref).present.add(steamId);
  }

  simulateLeave(ref: LobbyRef, steamId: string): void {
    this.require(ref).present.delete(steamId);
  }

  simulateAbandon(ref: LobbyRef, steamId: string): void {
    this.require(ref).abandoned.add(steamId);
  }

  simulateFinish(
    ref: LobbyRef,
    outcome: MatchTeam | 'unknown',
    dotaMatchId = '7000000001',
  ): void {
    const lobby = this.require(ref);
    lobby.state = 'postgame';
    lobby.outcome = outcome;
    lobby.dotaMatchId = dotaMatchId;
  }

  /** Simula que el lobby desapareció (el bot se cayó, Valve lo cerró). */
  simulateLobbyLost(ref: LobbyRef): void {
    this.lobbies.delete(ref.id);
  }

  configOf(ref: LobbyRef): LobbyConfig {
    return this.require(ref).config;
  }

  kickedFrom(ref: LobbyRef): string[] {
    return this.require(ref).kicked;
  }

  private require(ref: LobbyRef): FakeLobby {
    const lobby = this.lobbies.get(ref.id);
    if (!lobby) throw new Error(`Lobby simulado inexistente: ${ref.id}`);
    return lobby;
  }
}
