import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { Sanction } from './sanction.entity';

const base = {
  id: 's1',
  userId: 'u1',
  userDisplayName: 'Jugador',
  appliedBy: 'admin-1',
};

describe('Sanction.create', () => {
  it('crea una advertencia válida', () => {
    const s = Sanction.create({ ...base, type: 'warning', reason: 'Lenguaje tóxico en el chat.' });
    expect(s.type).toBe('warning');
    expect(s.isRevoked).toBe(false);
    expect(s.appliedAt).toBeInstanceOf(Date);
  });

  it('una multa necesita un monto positivo', () => {
    expect(() => Sanction.create({ ...base, type: 'fine', reason: 'Abandono repetido.' })).toThrow(
      'monto positivo',
    );
    expect(() =>
      Sanction.create({ ...base, type: 'fine', reason: 'Abandono repetido.', amountCents: 0 }),
    ).toThrow(InvalidDomainStateException);
    expect(() =>
      Sanction.create({ ...base, type: 'fine', reason: 'Abandono repetido.', amountCents: -100 }),
    ).toThrow(InvalidDomainStateException);
  });

  it('una multa válida guarda el monto', () => {
    const s = Sanction.create({ ...base, type: 'fine', reason: 'Abandono repetido.', amountCents: 500 });
    expect(s.amountCents).toBe(500);
  });

  it('una suspensión sin fecha es indefinida', () => {
    const s = Sanction.create({ ...base, type: 'suspension', reason: 'Colusión confirmada.' });
    expect(s.suspendedUntil).toBeUndefined();
    expect(s.isActiveSuspensionAt(new Date('2099-01-01'))).toBe(true);
  });

  it('una suspensión con fecha de fin debe ser en el futuro', () => {
    expect(() =>
      Sanction.create({
        ...base,
        type: 'suspension',
        reason: 'Colusión confirmada.',
        suspendedUntil: new Date(Date.now() - 1000),
      }),
    ).toThrow('futuro');
  });

  it('rechaza motivos muy cortos', () => {
    expect(() => Sanction.create({ ...base, type: 'warning', reason: 'no' })).toThrow(
      InvalidDomainStateException,
    );
  });

  it('rechaza un tipo inválido', () => {
    expect(() =>
      Sanction.create({ ...base, type: 'ban' as never, reason: 'Motivo suficientemente largo.' }),
    ).toThrow(InvalidDomainStateException);
  });
});

describe('Sanction.isActiveSuspensionAt', () => {
  it('una multa o advertencia nunca está "activa" como suspensión', () => {
    const fine = Sanction.create({ ...base, type: 'fine', reason: 'Motivo válido.', amountCents: 100 });
    const warning = Sanction.create({ ...base, type: 'warning', reason: 'Motivo válido.' });
    expect(fine.isActiveSuspensionAt(new Date())).toBe(false);
    expect(warning.isActiveSuspensionAt(new Date())).toBe(false);
  });

  it('una suspensión con plazo deja de estar activa después de vencer', () => {
    const until = new Date(Date.now() + 60_000);
    const s = Sanction.create({ ...base, type: 'suspension', reason: 'Motivo válido.', suspendedUntil: until });
    expect(s.isActiveSuspensionAt(new Date(until.getTime() - 1))).toBe(true);
    expect(s.isActiveSuspensionAt(new Date(until.getTime() + 1))).toBe(false);
  });

  it('una suspensión revocada no está activa aunque no haya vencido', () => {
    const s = Sanction.create({
      ...base,
      type: 'suspension',
      reason: 'Motivo válido.',
      suspendedUntil: new Date(Date.now() + 60_000),
    });
    s.revoke('admin-2', 'Fue un error');
    expect(s.isActiveSuspensionAt(new Date())).toBe(false);
  });
});

describe('Sanction.revoke', () => {
  it('revoca una vez y registra quién y por qué', () => {
    const s = Sanction.create({ ...base, type: 'warning', reason: 'Motivo válido.' });
    s.revoke('admin-2', 'Fue un malentendido');
    expect(s.isRevoked).toBe(true);
    expect(s.revokedBy).toBe('admin-2');
    expect(s.revokeReason).toBe('Fue un malentendido');
    expect(s.revokedAt).toBeInstanceOf(Date);
  });

  it('no se puede revocar dos veces', () => {
    const s = Sanction.create({ ...base, type: 'warning', reason: 'Motivo válido.' });
    s.revoke('admin-2', 'Motivo');
    expect(() => s.revoke('admin-2', 'Otro motivo')).toThrow('ya fue revocada');
  });

  it('exige un motivo de revocación', () => {
    const s = Sanction.create({ ...base, type: 'warning', reason: 'Motivo válido.' });
    expect(() => s.revoke('admin-2', 'x')).toThrow(InvalidDomainStateException);
  });
});
