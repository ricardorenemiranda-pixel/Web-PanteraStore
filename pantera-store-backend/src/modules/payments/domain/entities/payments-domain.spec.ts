import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { sniffImage } from '../../application/use-cases/payment-use-cases';
import { DepositRequest } from './deposit-request.entity';
import {
  checkAmount,
  checkDaily,
  checkPendingCount,
  type PaymentLimits,
} from './payment-limits';
import { assessDepositRisk, assessWithdrawalRisk } from './risk';
import { WithdrawalRequest } from './withdrawal-request.entity';

const limits: PaymentLimits = {
  deposit: {
    minCents: 500,
    maxCents: 20000,
    dailyMaxCents: 50000,
    maxPending: 3,
  },
  withdrawal: {
    minCents: 1000,
    maxCents: 20000,
    dailyMaxCents: 50000,
    maxPending: 2,
  },
};

describe('límites', () => {
  it('rechaza montos fuera del mínimo y máximo por operación', () => {
    expect(() => checkAmount('deposit', 499, limits)).toThrow('mínimo');
    expect(() => checkAmount('deposit', 20001, limits)).toThrow('máximo');
    expect(() => checkAmount('withdrawal', 999, limits)).toThrow('mínimo');
    expect(() => checkAmount('deposit', 500, limits)).not.toThrow();
    expect(() => checkAmount('deposit', 20000, limits)).not.toThrow();
  });

  it.each([0, -100, 1.5, NaN])('rechaza el monto inválido %p', (amount) => {
    expect(() => checkAmount('deposit', amount, limits)).toThrow(
      InvalidDomainStateException,
    );
  });

  it('el tope diario cuenta lo ya pedido y dice cuánto queda', () => {
    expect(() => checkDaily('deposit', 10000, 40000, limits)).not.toThrow();
    expect(() => checkDaily('deposit', 10001, 40000, limits)).toThrow(
      'límite diario',
    );
    expect(() => checkDaily('withdrawal', 10001, 40000, limits)).toThrow(
      /hasta S\/ 100\.00/,
    );
  });

  it('limita los pedidos pendientes', () => {
    expect(() => checkPendingCount('withdrawal', 1, limits)).not.toThrow();
    expect(() => checkPendingCount('withdrawal', 2, limits)).toThrow(
      'pendiente',
    );
  });
});

describe('DepositRequest', () => {
  const base = {
    id: 'd1',
    userId: 'u1',
    userDisplayName: 'Ana',
    amountCents: 2000,
    method: 'yape' as const,
    operationCode: ' ab-1234 ',
    proofContentType: 'image/png',
    riskFlags: [],
  };

  it('normaliza el número de operación y nace pendiente', () => {
    const d = DepositRequest.create(base);
    expect(d.operationCode).toBe('AB-1234');
    expect(d.status).toBe('pending');
  });

  it.each(['abc', 'con espacios', 'x'.repeat(41), '???###'])(
    'rechaza el número de operación %p',
    (code) => {
      expect(() =>
        DepositRequest.create({ ...base, operationCode: code }),
      ).toThrow(InvalidDomainStateException);
    },
  );

  it('aprobar registra quién, cuándo y cuánto se acreditó', () => {
    const d = DepositRequest.create(base);
    d.approve('admin1');
    expect(d.status).toBe('approved');
    expect(d.creditedCents).toBe(2000);
    expect(d.reviewedBy).toBe('admin1');
  });

  it('acreditar un monto distinto al pedido exige una nota', () => {
    const d = DepositRequest.create(base);
    expect(() => d.approve('admin1', 1500)).toThrow('motivo');
    d.approve('admin1', 1500, 'el comprobante decía S/ 15');
    expect(d.creditedCents).toBe(1500);
  });

  it('un pedido revisado no se puede revisar de nuevo', () => {
    const d = DepositRequest.create(base);
    d.reject('admin1', 'comprobante ilegible');
    expect(() => d.approve('admin2')).toThrow('ya fue revisado');
    expect(() => d.reject('admin2', 'otra vez')).toThrow('ya fue revisado');
    expect(d.reviewNote).toBe('comprobante ilegible');
  });

  it('rechazar exige motivo', () => {
    expect(() => DepositRequest.create(base).reject('a', ' ')).toThrow(
      'motivo',
    );
  });

  it('solo el dueño puede cancelar, y solo si sigue pendiente', () => {
    const d = DepositRequest.create(base);
    expect(() => d.cancel('otro')).toThrow('Solo quien hizo');
    d.cancel('u1');
    expect(d.status).toBe('cancelled');
    expect(() => d.cancel('u1')).toThrow('ya fue revisado');
  });
});

describe('WithdrawalRequest', () => {
  const base = {
    id: 'w1',
    userId: 'u1',
    userDisplayName: 'Ana',
    amountCents: 2000,
    method: 'yape' as const,
    destination: '987 654 321',
    holderName: 'Ana Pérez',
    riskFlags: [],
  };

  it('normaliza el destino', () => {
    expect(WithdrawalRequest.create(base).destination).toBe('987654321');
  });

  it('valida el destino según el método', () => {
    expect(() =>
      WithdrawalRequest.create({ ...base, destination: '12345' }),
    ).toThrow('celular');
    expect(() =>
      WithdrawalRequest.create({ ...base, destination: '887654321' }),
    ).toThrow('celular');
    expect(() =>
      WithdrawalRequest.create({
        ...base,
        method: 'transfer',
        destination: '987654321',
      }),
    ).toThrow('cuenta');
    expect(
      WithdrawalRequest.create({
        ...base,
        method: 'transfer',
        destination: '00219300123456789012',
      }).method,
    ).toBe('transfer');
  });

  it('exige titular', () => {
    expect(() =>
      WithdrawalRequest.create({ ...base, holderName: 'A' }),
    ).toThrow('titular');
  });

  it('pagar exige el número de operación del pago y no se puede pagar dos veces', () => {
    const w = WithdrawalRequest.create(base);
    expect(() => w.markPaid('admin', 'ab')).toThrow('número de operación');
    w.markPaid('admin', 'OP-998877');
    expect(w.status).toBe('paid');
    expect(w.payoutReference).toBe('OP-998877');
    expect(() => w.markPaid('admin', 'OP-111111')).toThrow('ya fue revisado');
    expect(() => w.reject('admin', 'tarde')).toThrow('ya fue revisado');
  });

  it('rechazar exige motivo; cancelar solo el dueño', () => {
    const w = WithdrawalRequest.create(base);
    expect(() => w.reject('admin', '')).toThrow('motivo');
    expect(() => w.cancel('otro')).toThrow('Solo quien hizo');
    w.cancel('u1');
    expect(w.status).toBe('cancelled');
  });
});

describe('señales de riesgo', () => {
  it('recarga tranquila: sin señales', () => {
    expect(
      assessDepositRisk({
        amountCents: 1000,
        limits,
        requestsLastHour: 0,
        rejectedDepositsLast30d: 0,
      }),
    ).toEqual([]);
  });

  it('recarga: monto alto, muchos pedidos y rechazos repetidos', () => {
    expect(
      assessDepositRisk({
        amountCents: 16000,
        limits,
        requestsLastHour: 3,
        rejectedDepositsLast30d: 3,
      }),
    ).toEqual(['high_amount', 'many_requests', 'repeated_rejections']);
  });

  const w = {
    amountCents: 2000,
    limits,
    requestsLastHour: 0,
    totalDepositedCents: 10000,
    totalPlayedCents: 10000,
    hoursSinceLastDeposit: 100,
    otherUsersWithSameDestination: 0,
  };

  it('retiro normal: quien jugó lo que recargó no levanta señales', () => {
    expect(assessWithdrawalRisk(w)).toEqual([]);
  });

  it('retirar dinero que casi no jugó', () => {
    expect(assessWithdrawalRisk({ ...w, totalPlayedCents: 4999 })).toContain(
      'withdraw_without_play',
    );
    expect(
      assessWithdrawalRisk({ ...w, totalPlayedCents: 5000 }),
    ).not.toContain('withdraw_without_play');
  });

  it('quien nunca recargó (solo ganó jugando) no es "retirar sin jugar"', () => {
    expect(
      assessWithdrawalRisk({
        ...w,
        totalDepositedCents: 0,
        totalPlayedCents: 0,
        hoursSinceLastDeposit: null,
      }),
    ).toEqual([]);
  });

  it('retiro poco después de recargar', () => {
    expect(assessWithdrawalRisk({ ...w, hoursSinceLastDeposit: 3 })).toContain(
      'recent_deposit',
    );
    expect(
      assessWithdrawalRisk({ ...w, hoursSinceLastDeposit: 24 }),
    ).not.toContain('recent_deposit');
  });

  it('destino compartido con otras cuentas y monto cercano al máximo', () => {
    expect(
      assessWithdrawalRisk({
        ...w,
        otherUsersWithSameDestination: 1,
        amountCents: 16000,
      }),
    ).toEqual(['high_amount', 'shared_destination']);
  });
});

describe('sniffImage (no se confía en lo que diga el navegador)', () => {
  it('reconoce PNG, JPEG y WEBP por sus primeros bytes', () => {
    expect(
      sniffImage(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
      ),
    ).toBe('image/png');
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe(
      'image/jpeg',
    );
    expect(
      sniffImage(
        Buffer.concat([
          Buffer.from('RIFF'),
          Buffer.from([0, 0, 0, 0]),
          Buffer.from('WEBPVP8 '),
        ]),
      ),
    ).toBe('image/webp');
  });

  it('rechaza cualquier otra cosa aunque se disfrace de imagen', () => {
    expect(sniffImage(Buffer.from('<script>alert(1)</script>'))).toBeNull();
    expect(sniffImage(Buffer.from('%PDF-1.4'))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
    expect(sniffImage(Buffer.from('GIF89a'))).toBeNull();
  });
});
