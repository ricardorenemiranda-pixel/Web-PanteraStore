import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { Report } from './report.entity';

const base = {
  id: 'r1',
  reporterId: 'reporter-1',
  reporterDisplayName: 'Reportero',
  reportedUserId: 'reported-1',
  reportedDisplayName: 'Reportado',
  category: 'toxic_chat' as const,
  description: 'Insultos constantes durante toda la partida.',
  hasEvidence: false,
};

describe('Report.create', () => {
  it('crea un reporte pendiente', () => {
    const r = Report.create(base);
    expect(r.status).toBe('pending');
    expect(r.createdAt).toBeInstanceOf(Date);
  });

  it('no se puede reportar a uno mismo', () => {
    expect(() => Report.create({ ...base, reportedUserId: base.reporterId })).toThrow(
      'reportarte a ti mismo',
    );
  });

  it('rechaza una categoría inválida', () => {
    expect(() => Report.create({ ...base, category: 'hacking' as never })).toThrow(
      InvalidDomainStateException,
    );
  });

  it('exige una descripción con detalle mínimo', () => {
    expect(() => Report.create({ ...base, description: 'corto' })).toThrow(InvalidDomainStateException);
  });
});

describe('Report.resolve / dismiss', () => {
  it('resolver marca el reporte y opcionalmente referencia una sanción', () => {
    const r = Report.create(base);
    r.resolve('admin-1', 'Se aplicó una multa', 'sanction-1');
    expect(r.status).toBe('resolved');
    expect(r.reviewedBy).toBe('admin-1');
    expect(r.sanctionId).toBe('sanction-1');
    expect(r.reviewedAt).toBeInstanceOf(Date);
  });

  it('descartar marca el reporte sin sanción', () => {
    const r = Report.create(base);
    r.dismiss('admin-1', 'Sin evidencia suficiente');
    expect(r.status).toBe('dismissed');
    expect(r.sanctionId).toBeUndefined();
  });

  it('un reporte ya revisado no se puede volver a revisar', () => {
    const r = Report.create(base);
    r.resolve('admin-1', 'nota');
    expect(() => r.resolve('admin-1', 'otra vez')).toThrow('ya fue revisado');
    expect(() => r.dismiss('admin-1', 'otra vez')).toThrow(InvalidDomainStateException);
  });

  it('una nota vacía se guarda como undefined', () => {
    const r = Report.create(base);
    r.dismiss('admin-1', '   ');
    expect(r.reviewNote).toBeUndefined();
  });
});
