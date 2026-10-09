import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../../config/configuration';
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from '../../../../shared/application/unit-of-work';
import {
  EntityNotFoundException,
  ForbiddenActionException,
  InvalidDomainStateException,
} from '../../../../shared/domain/exceptions/domain.exception';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../auth/domain/ports/user.repository.port';
import {
  CreditDepositUseCase,
  HoldWithdrawalUseCase,
  PayWithdrawalUseCase,
  ReleaseWithdrawalUseCase,
} from '../../../wallet/application/use-cases/payment-operations.use-cases';
import {
  DepositRequest,
  type DepositStatus,
} from '../../domain/entities/deposit-request.entity';
import {
  checkAmount,
  checkDaily,
  checkPendingCount,
  type PaymentLimits,
  type PaymentMethod,
} from '../../domain/entities/payment-limits';
import {
  assessDepositRisk,
  assessWithdrawalRisk,
} from '../../domain/entities/risk';
import {
  WithdrawalRequest,
  type WithdrawalStatus,
} from '../../domain/entities/withdrawal-request.entity';
import {
  DuplicateOperationCodeException,
  PAYMENTS_REPOSITORY,
  type PaymentsRepository,
  type ProofFile,
} from '../../domain/ports/payments.repository.port';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_PROOF_BYTES = 2 * 1024 * 1024;

export interface Actor {
  userId: string;
  role: 'customer' | 'admin';
}

/** Reconoce la imagen por sus primeros bytes: no se confía en lo que diga el navegador. */
export function sniffImage(data: Buffer): ProofFile['contentType'] | null {
  if (
    data.length >= 8 &&
    data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  )
    return 'image/jpeg';
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString('ascii') === 'RIFF' &&
    data.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** Comparte la configuración y las reglas de "quién puede mover dinero". */
@Injectable()
export class PaymentsPolicy {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  get limits(): PaymentLimits {
    return this.config.get('payments', { infer: true }).limits;
  }

  get instructions() {
    return this.config.get('payments', { infer: true }).instructions;
  }

  ensureEnabled(): void {
    if (!this.config.get('payments', { infer: true }).enabled) {
      throw new ForbiddenActionException(
        'Las recargas y retiros no están habilitados todavía.',
      );
    }
  }

  get enabled(): boolean {
    return this.config.get('payments', { infer: true }).enabled;
  }

  /** Para mover dinero real: cuenta existente, mayor de 18 y con Steam vinculado. */
  async requirePlayer(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new EntityNotFoundException('Usuario', userId);
    if (!user.isAdult()) {
      throw new InvalidDomainStateException(
        'Confirma que eres mayor de 18 años para recargar o retirar.',
      );
    }
    if (!user.steamId) {
      throw new InvalidDomainStateException(
        'Vincula tu cuenta de Steam antes de mover dinero.',
      );
    }
    return user;
  }
}

// ============================================================ RECARGAS

export interface RequestDepositInput {
  amountCents: number;
  method: PaymentMethod;
  operationCode: string;
}

@Injectable()
export class RequestDepositUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly policy: PaymentsPolicy,
  ) {}

  async execute(
    actor: Actor,
    input: RequestDepositInput,
    file: { data: Buffer },
  ): Promise<DepositRequest> {
    this.policy.ensureEnabled();
    const user = await this.policy.requirePlayer(actor.userId);

    if (!file?.data?.length)
      throw new InvalidDomainStateException(
        'Sube la foto o captura del comprobante.',
      );
    if (file.data.length > MAX_PROOF_BYTES) {
      throw new InvalidDomainStateException(
        'El comprobante pesa demasiado (máximo 2 MB).',
      );
    }
    const contentType = sniffImage(file.data);
    if (!contentType) {
      throw new InvalidDomainStateException(
        'El comprobante debe ser una imagen PNG, JPG o WEBP.',
      );
    }

    const limits = this.policy.limits;
    checkAmount('deposit', input.amountCents, limits);

    try {
      return await this.uow.run(async (tx) => {
        await this.payments.lockUser(actor.userId, tx);
        const now = Date.now();

        checkPendingCount(
          'deposit',
          await this.payments.countPendingDeposits(actor.userId, tx),
          limits,
        );
        const alreadyToday = await this.payments.sumDepositsSince(
          actor.userId,
          new Date(now - DAY_MS),
          tx,
        );
        checkDaily('deposit', input.amountCents, alreadyToday, limits);

        const riskFlags = assessDepositRisk({
          amountCents: input.amountCents,
          limits,
          requestsLastHour: await this.payments.countDepositsSince(
            actor.userId,
            new Date(now - HOUR_MS),
            tx,
          ),
          rejectedDepositsLast30d:
            await this.payments.countRejectedDepositsSince(
              actor.userId,
              new Date(now - 30 * DAY_MS),
              tx,
            ),
        });

        const deposit = DepositRequest.create({
          id: randomUUID(),
          userId: user.id,
          userDisplayName: user.displayName,
          amountCents: input.amountCents,
          method: input.method,
          operationCode: input.operationCode,
          proofContentType: contentType,
          riskFlags,
        });
        await this.payments.insertDeposit(
          deposit,
          { contentType, data: file.data },
          tx,
        );
        return deposit;
      });
    } catch (error) {
      if (error instanceof DuplicateOperationCodeException) {
        // Reusar un comprobante es una señal fuerte de fraude: queda una alerta para el admin.
        await this.payments.saveAlert({
          id: randomUUID(),
          kind: 'duplicate_operation_code',
          userId: actor.userId,
          refId: input.operationCode.trim().toUpperCase(),
          message: `${user.displayName} intentó registrar un número de operación ya usado (${input.method}).`,
          createdAt: new Date(),
        });
      }
      throw error;
    }
  }
}

@Injectable()
export class CancelDepositUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(actor: Actor, depositId: string): Promise<DepositRequest> {
    return this.uow.run(async (tx) => {
      const deposit = await this.payments.findDepositForUpdate(depositId, tx);
      if (!deposit) throw new EntityNotFoundException('Recarga', depositId);
      deposit.cancel(actor.userId);
      await this.payments.saveDeposit(deposit, tx);
      return deposit;
    });
  }
}

export interface ApproveDepositInput {
  /** Solo si lo que llegó es distinto a lo pedido. */
  creditedCents?: number;
  note?: string;
}

/** El admin confirmó que el dinero llegó: se acredita el saldo, UNA sola vez. */
@Injectable()
export class ApproveDepositUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly credit: CreditDepositUseCase,
    private readonly policy: PaymentsPolicy,
  ) {}

  async execute(
    adminId: string,
    depositId: string,
    input: ApproveDepositInput = {},
  ): Promise<DepositRequest> {
    this.policy.ensureEnabled();
    return this.uow.run(async (tx) => {
      const deposit = await this.payments.findDepositForUpdate(depositId, tx);
      if (!deposit) throw new EntityNotFoundException('Recarga', depositId);
      if (deposit.userId === adminId) {
        throw new ForbiddenActionException(
          'No puedes aprobar tu propia recarga: que la revise otro administrador.',
        );
      }

      deposit.approve(adminId, input.creditedCents, input.note);
      await this.credit.execute(
        {
          userId: deposit.userId,
          amountCents: deposit.creditedCents!,
          requestId: deposit.id,
          actorId: adminId,
          description: `Recarga ${deposit.method} (operación ${deposit.operationCode})`,
        },
        tx,
      );
      await this.payments.saveDeposit(deposit, tx);
      return deposit;
    });
  }
}

@Injectable()
export class RejectDepositUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(
    adminId: string,
    depositId: string,
    reason: string,
  ): Promise<DepositRequest> {
    return this.uow.run(async (tx) => {
      const deposit = await this.payments.findDepositForUpdate(depositId, tx);
      if (!deposit) throw new EntityNotFoundException('Recarga', depositId);
      deposit.reject(adminId, reason);
      await this.payments.saveDeposit(deposit, tx);
      return deposit;
    });
  }
}

// ============================================================ RETIROS

export interface RequestWithdrawalInput {
  amountCents: number;
  method: PaymentMethod;
  destination: string;
  holderName: string;
}

@Injectable()
export class RequestWithdrawalUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly hold: HoldWithdrawalUseCase,
    private readonly policy: PaymentsPolicy,
  ) {}

  async execute(
    actor: Actor,
    input: RequestWithdrawalInput,
  ): Promise<WithdrawalRequest> {
    this.policy.ensureEnabled();
    const user = await this.policy.requirePlayer(actor.userId);
    const limits = this.policy.limits;
    checkAmount('withdrawal', input.amountCents, limits);

    return this.uow.run(async (tx) => {
      await this.payments.lockUser(actor.userId, tx);
      const now = Date.now();

      checkPendingCount(
        'withdrawal',
        await this.payments.countPendingWithdrawals(actor.userId, tx),
        limits,
      );
      const alreadyToday = await this.payments.sumWithdrawalsSince(
        actor.userId,
        new Date(now - DAY_MS),
        tx,
      );
      checkDaily('withdrawal', input.amountCents, alreadyToday, limits);

      const request = WithdrawalRequest.create({
        id: randomUUID(),
        userId: user.id,
        userDisplayName: user.displayName,
        amountCents: input.amountCents,
        method: input.method,
        destination: input.destination,
        holderName: input.holderName,
        riskFlags: [],
      });

      const totals = await this.payments.lifetimeTotals(actor.userId, tx);
      const riskFlags = assessWithdrawalRisk({
        amountCents: input.amountCents,
        limits,
        requestsLastHour: await this.payments.countWithdrawalsSince(
          actor.userId,
          new Date(now - HOUR_MS),
          tx,
        ),
        totalDepositedCents: totals.depositedCents,
        totalPlayedCents: totals.playedCents,
        hoursSinceLastDeposit: totals.lastDepositAt
          ? (now - totals.lastDepositAt.getTime()) / HOUR_MS
          : null,
        otherUsersWithSameDestination:
          await this.payments.countOtherUsersWithDestination(
            actor.userId,
            request.destination,
            tx,
          ),
      });
      request.setRiskFlags(riskFlags);

      // Aparta el dinero (falla si no tiene saldo disponible suficiente → se deshace todo).
      await this.hold.execute(
        {
          userId: user.id,
          amountCents: input.amountCents,
          requestId: request.id,
          actorId: user.id,
          description: `Retiro solicitado (${input.method})`,
        },
        tx,
      );
      await this.payments.insertWithdrawal(request, tx);
      return request;
    });
  }
}

@Injectable()
export class CancelWithdrawalUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly release: ReleaseWithdrawalUseCase,
  ) {}

  async execute(
    actor: Actor,
    withdrawalId: string,
  ): Promise<WithdrawalRequest> {
    return this.uow.run(async (tx) => {
      const withdrawal = await this.payments.findWithdrawalForUpdate(
        withdrawalId,
        tx,
      );
      if (!withdrawal)
        throw new EntityNotFoundException('Retiro', withdrawalId);
      withdrawal.cancel(actor.userId);
      await this.release.execute(
        {
          userId: withdrawal.userId,
          amountCents: withdrawal.amountCents,
          requestId: withdrawal.id,
          actorId: actor.userId,
          description: 'Retiro cancelado por el usuario',
        },
        tx,
      );
      await this.payments.saveWithdrawal(withdrawal, tx);
      return withdrawal;
    });
  }
}

/** El admin ya transfirió el dinero: el monto apartado sale del sistema. */
@Injectable()
export class MarkWithdrawalPaidUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly pay: PayWithdrawalUseCase,
    private readonly policy: PaymentsPolicy,
  ) {}

  async execute(
    adminId: string,
    withdrawalId: string,
    payoutReference: string,
  ): Promise<WithdrawalRequest> {
    this.policy.ensureEnabled();
    return this.uow.run(async (tx) => {
      const withdrawal = await this.payments.findWithdrawalForUpdate(
        withdrawalId,
        tx,
      );
      if (!withdrawal)
        throw new EntityNotFoundException('Retiro', withdrawalId);
      if (withdrawal.userId === adminId) {
        throw new ForbiddenActionException(
          'No puedes pagar tu propio retiro: que lo revise otro administrador.',
        );
      }
      withdrawal.markPaid(adminId, payoutReference);
      await this.pay.execute(
        {
          userId: withdrawal.userId,
          amountCents: withdrawal.amountCents,
          requestId: withdrawal.id,
          actorId: adminId,
          description: `Retiro pagado (${withdrawal.method}, operación ${withdrawal.payoutReference})`,
        },
        tx,
      );
      await this.payments.saveWithdrawal(withdrawal, tx);
      return withdrawal;
    });
  }
}

@Injectable()
export class RejectWithdrawalUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly release: ReleaseWithdrawalUseCase,
  ) {}

  async execute(
    adminId: string,
    withdrawalId: string,
    reason: string,
  ): Promise<WithdrawalRequest> {
    return this.uow.run(async (tx) => {
      const withdrawal = await this.payments.findWithdrawalForUpdate(
        withdrawalId,
        tx,
      );
      if (!withdrawal)
        throw new EntityNotFoundException('Retiro', withdrawalId);
      withdrawal.reject(adminId, reason);
      await this.release.execute(
        {
          userId: withdrawal.userId,
          amountCents: withdrawal.amountCents,
          requestId: withdrawal.id,
          actorId: adminId,
          description: `Retiro rechazado: ${withdrawal.reviewNote}`,
        },
        tx,
      );
      await this.payments.saveWithdrawal(withdrawal, tx);
      return withdrawal;
    });
  }
}

// ============================================================ CONSULTAS

/** Lo que un jugador necesita para recargar: límites y dónde pagar. */
@Injectable()
export class GetPaymentsConfigUseCase {
  constructor(private readonly policy: PaymentsPolicy) {}

  execute() {
    return {
      enabled: this.policy.enabled,
      limits: this.policy.limits,
      instructions: this.policy.instructions,
    };
  }
}

@Injectable()
export class ListMyPaymentsUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
  ) {}

  async execute(userId: string) {
    const [deposits, withdrawals] = await Promise.all([
      this.payments.listDepositsOfUser(userId, 50),
      this.payments.listWithdrawalsOfUser(userId, 50),
    ]);
    return { deposits, withdrawals };
  }
}

@Injectable()
export class ListPaymentsForAdminUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
  ) {}

  async execute(
    filter: {
      depositStatuses?: DepositStatus[];
      withdrawalStatuses?: WithdrawalStatus[];
    } = {},
  ) {
    const [deposits, withdrawals] = await Promise.all([
      this.payments.listDeposits(filter.depositStatuses, 100),
      this.payments.listWithdrawals(filter.withdrawalStatuses, 100),
    ]);
    return { deposits, withdrawals };
  }
}

@Injectable()
export class GetDepositProofUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
  ) {}

  async execute(depositId: string): Promise<ProofFile> {
    const proof = await this.payments.getProof(depositId);
    if (!proof) throw new EntityNotFoundException('Comprobante', depositId);
    return proof;
  }
}

// ============================================================ TESORERÍA Y ALERTAS

@Injectable()
export class GetTreasuryUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
  ) {}

  execute() {
    return this.payments.treasury();
  }
}

export type AlertSeverity = 'high' | 'medium';

export interface AlertView {
  id: string;
  kind: string;
  severity: AlertSeverity;
  message: string;
  userId?: string;
  refId?: string;
  at: Date;
  /** Solo las guardadas se pueden marcar como resueltas. */
  resolvable: boolean;
}

/**
 * Reúne todo lo raro en un solo lugar: intentos de reusar comprobantes,
 * pedidos pendientes con señales de riesgo, y —lo más grave— cualquier
 * billetera cuyo saldo no coincida con su libro o dinero que no cuadre.
 */
@Injectable()
export class GetAlertsUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
  ) {}

  async execute(): Promise<AlertView[]> {
    const [stored, pendingDeposits, pendingWithdrawals, outOfSync, treasury] =
      await Promise.all([
        this.payments.listOpenAlerts(),
        this.payments.listDeposits(['pending'], 200),
        this.payments.listWithdrawals(['pending'], 200),
        this.payments.walletsOutOfSync(50),
        this.payments.treasury(),
      ]);

    const alerts: AlertView[] = [];
    if (treasury.discrepancyCents !== 0) {
      alerts.push({
        id: 'treasury-discrepancy',
        kind: 'money_mismatch',
        severity: 'high',
        message: `El dinero no cuadra: hay una diferencia de ${(treasury.discrepancyCents / 100).toFixed(2)} soles entre las billeteras y lo que entró y salió.`,
        at: new Date(),
        resolvable: false,
      });
    }
    for (const w of outOfSync) {
      alerts.push({
        id: `wallet-${w.walletId}`,
        kind: 'wallet_out_of_sync',
        severity: 'high',
        message: `La billetera del usuario ${w.userId} no coincide con su libro de movimientos.`,
        userId: w.userId,
        at: new Date(),
        resolvable: false,
      });
    }
    for (const a of stored) {
      alerts.push({
        id: a.id,
        kind: a.kind,
        severity: 'high',
        message: a.message,
        userId: a.userId,
        refId: a.refId,
        at: a.createdAt,
        resolvable: true,
      });
    }
    for (const d of pendingDeposits.filter((x) => x.riskFlags.length > 0)) {
      alerts.push({
        id: `deposit-${d.id}`,
        kind: 'risky_deposit',
        severity: 'medium',
        message: `Recarga pendiente de ${d.userDisplayName} con señales de riesgo: ${d.riskFlags.join(', ')}.`,
        userId: d.userId,
        refId: d.id,
        at: d.createdAt,
        resolvable: false,
      });
    }
    for (const w of pendingWithdrawals.filter((x) => x.riskFlags.length > 0)) {
      alerts.push({
        id: `withdrawal-${w.id}`,
        kind: 'risky_withdrawal',
        severity: 'medium',
        message: `Retiro pendiente de ${w.userDisplayName} con señales de riesgo: ${w.riskFlags.join(', ')}.`,
        userId: w.userId,
        refId: w.id,
        at: w.createdAt,
        resolvable: false,
      });
    }
    const order = { high: 0, medium: 1 } as const;
    return alerts.sort(
      (a, b) =>
        order[a.severity] - order[b.severity] ||
        b.at.getTime() - a.at.getTime(),
    );
  }
}

@Injectable()
export class ResolveAlertUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly payments: PaymentsRepository,
  ) {}

  async execute(adminId: string, alertId: string): Promise<void> {
    if (!(await this.payments.resolveAlert(alertId, adminId))) {
      throw new EntityNotFoundException('Alerta', alertId);
    }
  }
}
