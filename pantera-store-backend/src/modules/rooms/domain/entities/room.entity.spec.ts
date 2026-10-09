import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { Room, type RoomPlayer } from './room.entity';

const base = {
  id: 'r1',
  name: 'Los fuertes sobreviven',
  mode: 'captains_mode' as const,
  capacity: 4,
  entryFeeCents: 1100,
  platformFeePercent: 10,
  createdBy: 'u1',
  createdByName: 'Creador',
};

const player = (n: number): RoomPlayer => ({
  userId: `u${n}`,
  displayName: `Jugador ${n}`,
  joinId: `j${n}`,
  joinedAt: new Date(),
});

describe('Room.create', () => {
  it('calcula la comisión y el premio y los congela', () => {
    const room = Room.create(base);
    // 4 x S/ 11 = S/ 44; comisión 10% = S/ 4.40; premio S/ 39.60
    expect(room.platformFeeCents).toBe(440);
    expect(room.prizePoolCents).toBe(3960);
    expect(room.platformFeeCents + room.prizePoolCents).toBe(
      base.entryFeeCents * base.capacity,
    );
    expect(room.status).toBe('waiting');
  });

  it('con comisión redonda hacia abajo, el dinero siempre cuadra al céntimo', () => {
    const room = Room.create({
      ...base,
      entryFeeCents: 333,
      platformFeePercent: 7,
    });
    expect(room.platformFeeCents + room.prizePoolCents).toBe(333 * 4);
  });

  it('sin comisión, todo va al premio', () => {
    const room = Room.create({ ...base, platformFeePercent: 0 });
    expect(room.prizePoolCents).toBe(4400);
  });

  it.each([
    ['nombre muy corto', { name: 'ab' }],
    ['modo inválido', { mode: 'otro' as never }],
    ['cupos impares', { capacity: 3 }],
    ['cupos de más', { capacity: 12 }],
    ['cupos de menos', { capacity: 0 }],
    ['entrada muy baja', { entryFeeCents: 99 }],
    ['entrada muy alta', { entryFeeCents: 50_001 }],
    ['entrada con decimales', { entryFeeCents: 1100.5 }],
  ])('rechaza %s', (_label, override) => {
    expect(() => Room.create({ ...base, ...override })).toThrow(
      InvalidDomainStateException,
    );
  });
});

describe('Room.join', () => {
  it('suma jugadores y al llenarse pasa a "lista para jugar"', () => {
    const room = Room.create(base);
    room.join(player(1));
    room.join(player(2));
    room.join(player(3));
    expect(room.status).toBe('waiting');
    room.join(player(4));
    expect(room.status).toBe('full');
    expect(room.players).toHaveLength(4);
  });

  it('no deja pasar el cupo ni entrar dos veces', () => {
    const room = Room.create({ ...base, capacity: 2 });
    room.join(player(1));
    expect(() => room.join(player(1))).toThrow('Ya estás');
    room.join(player(2));
    expect(() => room.join(player(3))).toThrow('llena');
  });

  it('no deja entrar a una sala cancelada', () => {
    const room = Room.create(base);
    room.cancel();
    expect(() => room.join(player(1))).toThrow(InvalidDomainStateException);
  });
});

describe('Room.leave', () => {
  const withPlayers = () => {
    const room = Room.create({ ...base, capacity: 2 });
    room.join(player(1)); // el creador (u1)
    room.join(player(2));
    return room;
  };

  it('devuelve la participación y una sala llena vuelve a esperar', () => {
    const room = withPlayers();
    expect(room.status).toBe('full');
    const left = room.leave('u2');
    expect(left.joinId).toBe('j2');
    expect(room.status).toBe('waiting');
    expect(room.hasPlayer('u2')).toBe(false);
  });

  it('el creador no puede salir: tiene que cancelar', () => {
    expect(() => withPlayers().leave('u1')).toThrow('cancélala');
  });

  it('no se puede salir si no se está adentro', () => {
    expect(() => withPlayers().leave('u9')).toThrow('No estás');
  });
});

describe('Room.cancel', () => {
  it('devuelve a todos los jugadores para reembolsarlos y deja la sala vacía', () => {
    const room = Room.create(base);
    room.join(player(1));
    room.join(player(2));
    const refunds = room.cancel();
    expect(refunds.map((p) => p.userId)).toEqual(['u1', 'u2']);
    expect(room.status).toBe('cancelled');
    expect(room.players).toHaveLength(0);
  });

  it('no se puede cancelar dos veces', () => {
    const room = Room.create(base);
    room.cancel();
    expect(() => room.cancel()).toThrow(InvalidDomainStateException);
  });
});
