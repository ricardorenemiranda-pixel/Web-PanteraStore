import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { Match, type MatchParticipant, splitIntoTeams } from './match.entity';

const participants = (n = 4): MatchParticipant[] =>
  Array.from({ length: n }, (_, i) => ({
    userId: `u${i}`,
    steamId: `7656${i}`,
    displayName: `Jugador ${i}`,
    team: i < n / 2 ? ('radiant' as const) : ('dire' as const),
  }));

const automated = () =>
  Match.create({
    id: 'm1',
    roomId: 'r1',
    provider: 'fake',
    participants: participants(),
    lobbyRef: 'lobby-1',
    lobbyName: 'Pantera R1',
    lobbyPassword: 'ABC234',
    joinDeadline: new Date('2026-01-01T00:05:00Z'),
  });

describe('splitIntoTeams', () => {
  it('reparte en dos equipos iguales sin perder ni repetir a nadie', () => {
    const { radiant, dire } = splitIntoTeams([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(radiant).toHaveLength(5);
    expect(dire).toHaveLength(5);
    expect([...radiant, ...dire].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('es aleatorio: con azar distinto, distinto reparto', () => {
    const players = [1, 2, 3, 4, 5, 6];
    const a = splitIntoTeams(players, () => 0);
    const b = splitIntoTeams(players, () => 0.999);
    expect(a.radiant).not.toEqual(b.radiant);
  });

  it('no modifica la lista original', () => {
    const players = [1, 2, 3, 4];
    splitIntoTeams(players);
    expect(players).toEqual([1, 2, 3, 4]);
  });
});

describe('Match.create', () => {
  it('con lobby, espera jugadores', () => {
    expect(automated().status).toBe('waiting_players');
  });

  it('sin lobby (manual), ya está en juego', () => {
    const m = Match.create({
      id: 'm',
      roomId: 'r',
      provider: 'manual',
      participants: participants(),
    });
    expect(m.status).toBe('in_game');
    expect(m.lobbyName).toBeUndefined();
  });

  it('exige equipos parejos', () => {
    const uneven = participants().map((p, i) => ({
      ...p,
      team: i === 0 ? ('radiant' as const) : ('dire' as const),
    }));
    expect(() =>
      Match.create({
        id: 'm',
        roomId: 'r',
        provider: 'manual',
        participants: uneven,
      }),
    ).toThrow(InvalidDomainStateException);
  });
});

describe('presencia y arranque', () => {
  it('ignora cuentas que no son de la sala', () => {
    const m = automated();
    m.recordPresence(['76560', '76561', 'intruso']);
    expect(m.presentSteamIds.sort()).toEqual(['76560', '76561']);
    expect(m.allPresent).toBe(false);
    expect(m.missingParticipants.map((p) => p.userId).sort()).toEqual([
      'u2',
      'u3',
    ]);
  });

  it('no arranca si falta alguien; arranca cuando están todos', () => {
    const m = automated();
    m.recordPresence(['76560']);
    expect(() => m.start()).toThrow('Faltan');
    m.recordPresence(['76560', '76561', '76562', '76563']);
    m.start();
    expect(m.status).toBe('in_game');
  });

  it('detecta cuando venció el plazo', () => {
    const m = automated();
    expect(m.deadlinePassed(new Date('2026-01-01T00:04:59Z'))).toBe(false);
    expect(m.deadlinePassed(new Date('2026-01-01T00:05:01Z'))).toBe(true);
  });
});

describe('resultado', () => {
  const inGame = () => {
    const m = automated();
    m.recordPresence(['76560', '76561', '76562', '76563']);
    m.start();
    return m;
  };

  it('registra ganador, fuente y abandonos; los ganadores son el equipo que ganó', () => {
    const m = inGame();
    m.finish({
      outcome: 'dire',
      source: 'bot',
      dotaMatchId: '123',
      abandonedUserIds: ['u2'],
    });
    expect(m.status).toBe('finished');
    expect(m.winners.map((p) => p.userId)).toEqual(['u2', 'u3']);
    expect(m.abandonedUserIds).toEqual(['u2']);
    expect(m.dotaMatchId).toBe('123');
    expect(m.finishedAt).toBeDefined();
  });

  it('no se puede decidir dos veces', () => {
    const m = inGame();
    m.finish({ outcome: 'radiant', source: 'admin' });
    expect(() => m.finish({ outcome: 'dire', source: 'admin' })).toThrow(
      'ya tiene un resultado',
    );
    expect(m.outcome).toBe('radiant');
  });

  it('no se puede decidir antes de jugar', () => {
    expect(() =>
      automated().finish({ outcome: 'radiant', source: 'admin' }),
    ).toThrow(InvalidDomainStateException);
  });

  it('marcar para revisión no cambia el estado y se limpia al decidir', () => {
    const m = inGame();
    m.flagForReview();
    expect(m.needsReview).toBe(true);
    expect(m.status).toBe('in_game');
    m.finish({ outcome: 'radiant', source: 'admin' });
    expect(m.needsReview).toBe(false);
  });

  it('una partida que espera puede fallar; una en juego no', () => {
    const waiting = automated();
    waiting.fail('players_no_show');
    expect(waiting.status).toBe('failed');
    expect(waiting.failureReason).toBe('players_no_show');
    expect(() => inGame().fail('x')).toThrow(InvalidDomainStateException);
  });
});
