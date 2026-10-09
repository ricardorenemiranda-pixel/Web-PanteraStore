import { Injectable } from '@nestjs/common';
import type {
  LobbyProvider,
  LobbyRef,
  LobbySnapshot,
} from '../../domain/ports/lobby-provider.port';

/**
 * Sin bot: no se crea ningún lobby. Los jugadores se organizan por su cuenta
 * (Discord, WhatsApp) y un administrador registra el ganador. Es el modo por
 * defecto y el plan B si el bot no está disponible o Valve lo bloquea.
 */
@Injectable()
export class ManualLobbyProvider implements LobbyProvider {
  readonly kind = 'manual' as const;

  openLobby(): Promise<LobbyRef | null> {
    return Promise.resolve(null);
  }
  snapshot(): Promise<LobbySnapshot | null> {
    return Promise.resolve(null);
  }
  launch(): Promise<void> {
    return Promise.resolve();
  }
  kick(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}
