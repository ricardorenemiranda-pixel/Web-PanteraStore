import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { ageOn, User } from './user.entity';

const now = new Date('2026-09-25T12:00:00Z');

describe('ageOn', () => {
  it('cuenta años cumplidos (no años del calendario)', () => {
    expect(ageOn('2008-09-25', now)).toBe(18); // cumple hoy
    expect(ageOn('2008-09-26', now)).toBe(17); // mañana cumple
    expect(ageOn('2000-01-01', now)).toBe(26);
  });

  it('nacidos el 29 de febrero', () => {
    expect(ageOn('2008-02-29', new Date('2026-02-28T12:00:00Z'))).toBe(17);
    expect(ageOn('2008-02-29', new Date('2026-03-01T12:00:00Z'))).toBe(18);
  });

  it.each([
    '',
    'ayer',
    '2000/01/01',
    '2000-13-01',
    '2000-02-30',
    '2027-01-01',
    '26-09-2000',
  ])('devuelve null para %p', (value) => {
    expect(ageOn(value, now)).toBeNull();
  });
});

describe('User.confirmAdult', () => {
  const user = () =>
    User.create({ id: 'u', displayName: 'Ana', role: 'customer' });

  it('un mayor queda confirmado y se guarda la fecha', () => {
    const u = user();
    expect(u.isAdult()).toBe(false);
    u.confirmAdult('1995-05-20', now);
    expect(u.isAdult()).toBe(true);
    expect(u.birthDate).toBe('1995-05-20');
    expect(u.adultConfirmedAt).toEqual(now);
  });

  it('un menor de 18 NO queda confirmado, aunque le falte un día', () => {
    const u = user();
    expect(() => u.confirmAdult('2008-09-26', now)).toThrow('al menos 18');
    expect(u.isAdult()).toBe(false);
    expect(u.birthDate).toBeUndefined();
  });

  it('rechaza fechas inválidas', () => {
    const u = user();
    expect(() => u.confirmAdult('2000-02-30', now)).toThrow(
      InvalidDomainStateException,
    );
    expect(() => u.confirmAdult('mañana', now)).toThrow('AAAA-MM-DD');
    expect(u.isAdult()).toBe(false);
  });
});
