import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { Match, type MatchParticipant } from './match.entity';
import { Room, type RoomPlayer } from './room.entity';
import { computeSettlement, Settlement } from './settlement.entity';

describe('computeSettlement', () => {
  it('reparte la bolsa entre los ganadores y la comisión va a la plataforma', () => {
    // 4 jugadores x S/ 11 = S/ 44; comisión 10% (S/ 4.40); bolsa S/ 39.60; 2 ganadores.
    const r = computeSettlement({
      entryFeeCents: 1100,
      playerCount: 4,
      prizePoolCents: 3960,
      winnerCount: 2,
    });
    expect(r).toEqual({ prizeEachCents: 1980, platformCents: 440 });
  });

  it('los céntimos que no se dividen exacto se los queda la plataforma (no desaparecen)', () => {
    // 6 x 333 = 1998; comisión 199; bolsa 1799; 3 ganadores -> 599 c/u = 1797; sobran 2.
    const r = computeSettlement({
      entryFeeCents: 333,
      playerCount: 6,
      prizePoolCents: 1799,
      winnerCount: 3,
    });
    expect(r.prizeEachCents).toBe(599);
    expect(r.platformCents).toBe(1998 - 599 * 3);
    expect(r.platformCents).toBe(201);
  });

  it('SIEMPRE: entradas = premios + plataforma, con cualquier combinación', () => {
    for (let capacity = 2; capacity <= 10; capacity += 2) {
      for (const entryFeeCents of [100, 101, 333, 1100, 1999, 50_000]) {
        for (const percent of [0, 1, 7, 10, 33, 50]) {
          const room = Room.create({
            id: 'r',
            name: 'Sala',
            mode: 'turbo',
            capacity,
            entryFeeCents,
            platformFeePercent: percent,
            createdBy: 'u',
            createdByName: 'U',
          });
          const r = computeSettlement({
            entryFeeCents,
            playerCount: capacity,
            prizePoolCents: room.prizePoolCents,
            winnerCount: capacity / 2,
          });
          expect(r.prizeEachCents * (capacity / 2) + r.platformCents).toBe(
            entryFeeCents * capacity,
          );
          expect(r.platformCents).toBeGreaterThanOrEqual(room.platformFeeCents);
          expect(r.prizeEachCents).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('exige al menos un ganador y un perdedor', () => {
    const base = { entryFeeCents: 1000, playerCount: 4, prizePoolCents: 3600 };
    expect(() => computeSettlement({ ...base, winnerCount: 0 })).toThrow(
      InvalidDomainStateException,
    );
    expect(() => computeSettlement({ ...base, winnerCount: 4 })).toThrow(
      InvalidDomainStateException,
    );
  });

  it('rechaza una bolsa mayor a lo cobrado', () => {
    expect(() =>
      computeSettlement({
        entryFeeCents: 1000,
        playerCount: 4,
        prizePoolCents: 4001,
        winnerCount: 2,
      }),
    ).toThrow(InvalidDomainStateException);
  });
});

describe('Settlement.create', () => {
  const payouts = (prize: number) => [
    {
      userId: 'a',
      displayName: 'A',
      team: 'radiant' as const,
      won: true,
      entryCents: 1000,
      prizeCents: prize,
    },
    {
      userId: 'b',
      displayName: 'B',
      team: 'dire' as const,
      won: false,
      entryCents: 1000,
      prizeCents: 0,
    },
  ];
  const base = {
    id: 's1',
    matchId: 'm1',
    roomId: 'r1',
    entryFeeCents: 1000,
    playerCount: 2,
    prizePoolCents: 1800,
    prizeEachCents: 1800,
    platformCents: 200,
  };

  it('acepta una liquidación que cuadra', () => {
    const s = Settlement.create({ ...base, payouts: payouts(1800) });
    expect(s.payoutOf('a')?.prizeCents).toBe(1800);
    expect(s.payoutOf('zzz')).toBeUndefined();
  });

  it('rechaza una que no cuadra (así una suma mal hecha nunca se guarda)', () => {
    expect(() =>
      Settlement.create({ ...base, payouts: payouts(1900) }),
    ).toThrow('no cuadra');
  });
});

describe('Room.finish / Room.voidGame', () => {
  const playing = () => {
    const room = Room.create({
      id: 'r',
      name: 'Sala',
      mode: 'turbo',
      capacity: 2,
      entryFeeCents: 1000,
      platformFeePercent: 10,
      createdBy: 'u0',
      createdByName: 'U0',
    });
    for (let i = 0; i < 2; i++) {
      const p: RoomPlayer = {
        userId: `u${i}`,
        displayName: `U${i}`,
        joinId: `j${i}`,
        joinedAt: new Date(),
      };
      room.join(p);
    }
    room.startGame();
    return room;
  };

  it('finish: solo una sala jugando termina', () => {
    const room = playing();
    room.finish();
    expect(room.status).toBe('finished');
    expect(() => room.finish()).toThrow(InvalidDomainStateException);
  });

  it('voidGame: devuelve a todos para reembolsarlos y cancela la sala', () => {
    const room = playing();
    const refunds = room.voidGame();
    expect(refunds.map((p) => p.userId)).toEqual(['u0', 'u1']);
    expect(room.status).toBe('cancelled');
    expect(room.players).toHaveLength(0);
  });

  it('una sala que no está jugando no se puede terminar ni anular', () => {
    const room = Room.create({
      id: 'r',
      name: 'Sala',
      mode: 'turbo',
      capacity: 2,
      entryFeeCents: 1000,
      platformFeePercent: 10,
      createdBy: 'u0',
      createdByName: 'U0',
    });
    expect(() => room.finish()).toThrow(InvalidDomainStateException);
    expect(() => room.voidGame()).toThrow(InvalidDomainStateException);
  });
});

describe('Match.void', () => {
  const participants: MatchParticipant[] = [
    { userId: 'a', steamId: '1', displayName: 'A', team: 'radiant' },
    { userId: 'b', steamId: '2', displayName: 'B', team: 'dire' },
  ];

  it('anula una partida en juego y ya no se puede decidir', () => {
    const m = Match.create({
      id: 'm',
      roomId: 'r',
      provider: 'manual',
      participants,
    });
    m.void('empate');
    expect(m.status).toBe('voided');
    expect(m.failureReason).toBe('empate');
    expect(() => m.finish({ outcome: 'radiant', source: 'admin' })).toThrow(
      InvalidDomainStateException,
    );
  });

  it('no se puede anular una partida que ya tiene resultado', () => {
    const m = Match.create({
      id: 'm',
      roomId: 'r',
      provider: 'manual',
      participants,
    });
    m.finish({ outcome: 'radiant', source: 'admin' });
    expect(() => m.void('x')).toThrow(InvalidDomainStateException);
  });
});
