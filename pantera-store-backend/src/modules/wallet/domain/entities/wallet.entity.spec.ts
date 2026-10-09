import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { deltaFor, validateNewEntry } from './ledger-entry.entity';
import { Wallet } from './wallet.entity';

describe('deltaFor', () => {
  it('cada tipo mueve las cajas correctas', () => {
    expect(deltaFor('DEPOSIT', 1000)).toEqual({
      availableCents: 1000,
      lockedCents: 0,
    });
    expect(deltaFor('PRIZE', 500)).toEqual({
      availableCents: 500,
      lockedCents: 0,
    });
    expect(deltaFor('WITHDRAWAL', 300)).toEqual({
      availableCents: -300,
      lockedCents: 0,
    });
    expect(deltaFor('STAKE_LOCK', 1100)).toEqual({
      availableCents: -1100,
      lockedCents: 1100,
    });
    expect(deltaFor('STAKE_RELEASE', 1100)).toEqual({
      availableCents: 1100,
      lockedCents: -1100,
    });
    expect(deltaFor('STAKE_CHARGE', 1100)).toEqual({
      availableCents: 0,
      lockedCents: -1100,
    });
  });

  it('un ajuste exige dirección', () => {
    expect(() => deltaFor('ADJUSTMENT', 100)).toThrow(
      InvalidDomainStateException,
    );
    expect(deltaFor('ADJUSTMENT', 100, 'debit')).toEqual({
      availableCents: -100,
      lockedCents: 0,
    });
    expect(deltaFor('ADJUSTMENT', 100, 'credit')).toEqual({
      availableCents: 100,
      lockedCents: 0,
    });
  });

  it.each([0, -5, 1.5, NaN, Number.MAX_SAFE_INTEGER + 2])(
    'rechaza el monto %p',
    (amount) => {
      expect(() => deltaFor('DEPOSIT', amount)).toThrow(
        InvalidDomainStateException,
      );
    },
  );

  it('todo movimiento conserva el dinero (disponible + bloqueado) salvo entrada/salida real', () => {
    const internal = ['STAKE_LOCK', 'STAKE_RELEASE'] as const;
    for (const type of internal) {
      const d = deltaFor(type, 700);
      expect(d.availableCents + d.lockedCents).toBe(0);
    }
  });
});

describe('validateNewEntry', () => {
  const base = {
    type: 'DEPOSIT' as const,
    amountCents: 100,
    idempotencyKey: 'k1',
    createdBy: 'system',
  };

  it('acepta un movimiento completo', () => {
    expect(() => validateNewEntry(base)).not.toThrow();
  });

  it('exige clave de idempotencia y autor', () => {
    expect(() => validateNewEntry({ ...base, idempotencyKey: ' ' })).toThrow(
      InvalidDomainStateException,
    );
    expect(() => validateNewEntry({ ...base, createdBy: '' })).toThrow(
      InvalidDomainStateException,
    );
  });

  it('un ajuste sin motivo se rechaza', () => {
    const adj = {
      ...base,
      type: 'ADJUSTMENT' as const,
      direction: 'credit' as const,
    };
    expect(() => validateNewEntry(adj)).toThrow(InvalidDomainStateException);
    expect(() =>
      validateNewEntry({ ...adj, description: 'corrección de recarga' }),
    ).not.toThrow();
  });
});

describe('Wallet', () => {
  const fresh = () => Wallet.create({ id: 'w1', userId: 'u1', kind: 'user' });

  it('arranca en cero', () => {
    const w = fresh();
    expect(w.availableCents).toBe(0);
    expect(w.lockedCents).toBe(0);
    expect(w.currency).toBe('PEN');
  });

  it('flujo completo de una sala: recarga, bloqueo, cobro y premio', () => {
    const w = fresh();
    w.applyDelta(deltaFor('DEPOSIT', 5000));
    w.applyDelta(deltaFor('STAKE_LOCK', 1100));
    expect([w.availableCents, w.lockedCents]).toEqual([3900, 1100]);
    w.applyDelta(deltaFor('STAKE_CHARGE', 1100));
    w.applyDelta(deltaFor('PRIZE', 2000));
    expect([w.availableCents, w.lockedCents]).toEqual([5900, 0]);
  });

  it('no deja gastar más de lo disponible', () => {
    const w = fresh();
    w.applyDelta(deltaFor('DEPOSIT', 1000));
    expect(() => w.applyDelta(deltaFor('STAKE_LOCK', 1001))).toThrow(
      InvalidDomainStateException,
    );
    expect(() => w.applyDelta(deltaFor('WITHDRAWAL', 1001))).toThrow(
      InvalidDomainStateException,
    );
    expect(w.availableCents).toBe(1000);
  });

  it('no deja liberar ni cobrar más de lo bloqueado', () => {
    const w = fresh();
    w.applyDelta(deltaFor('DEPOSIT', 1000));
    w.applyDelta(deltaFor('STAKE_LOCK', 500));
    expect(() => w.applyDelta(deltaFor('STAKE_RELEASE', 501))).toThrow(
      InvalidDomainStateException,
    );
    expect(() => w.applyDelta(deltaFor('STAKE_CHARGE', 501))).toThrow(
      InvalidDomainStateException,
    );
    expect([w.availableCents, w.lockedCents]).toEqual([500, 500]);
  });
});
