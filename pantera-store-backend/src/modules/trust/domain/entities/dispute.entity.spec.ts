import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { Dispute } from './dispute.entity';

const base = {
  id: 'd1',
  matchId: 'match-1',
  roomId: 'room-1',
  raisedBy: 'user-1',
  raisedByDisplayName: 'Jugador',
  reason: 'El rival usó un script de auto-aim, tengo captura de pantalla.',
  hasEvidence: true,
};

describe('Dispute.create', () => {
  it('crea una disputa pendiente', () => {
    const d = Dispute.create(base);
    expect(d.status).toBe('pending');
    expect(d.createdAt).toBeInstanceOf(Date);
  });

  it('exige un motivo con detalle mínimo', () => {
    expect(() => Dispute.create({ ...base, reason: 'corto' })).toThrow(InvalidDomainStateException);
  });
});

describe('Dispute.uphold / reject', () => {
  it('uphold marca la disputa como aceptada', () => {
    const d = Dispute.create(base);
    d.uphold('admin-1', 'Se confirmó la trampa');
    expect(d.status).toBe('upheld');
    expect(d.resolvedBy).toBe('admin-1');
    expect(d.resolutionNote).toBe('Se confirmó la trampa');
    expect(d.resolvedAt).toBeInstanceOf(Date);
  });

  it('reject marca la disputa como rechazada, sin tocar el resultado', () => {
    const d = Dispute.create(base);
    d.reject('admin-1', 'No hay evidencia suficiente');
    expect(d.status).toBe('rejected');
    expect(d.resolvedBy).toBe('admin-1');
  });

  it('una disputa ya resuelta no se puede resolver de nuevo (protege de doble reversión)', () => {
    const d = Dispute.create(base);
    d.uphold('admin-1', 'nota');
    expect(() => d.uphold('admin-1', 'otra vez')).toThrow('ya fue resuelta');
    expect(() => d.reject('admin-1', 'otra vez')).toThrow(InvalidDomainStateException);
  });

  it('una nota vacía se guarda como undefined', () => {
    const d = Dispute.create(base);
    d.reject('admin-1', '   ');
    expect(d.resolutionNote).toBeUndefined();
  });
});
