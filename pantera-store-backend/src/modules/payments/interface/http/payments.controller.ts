import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../../auth/interface/decorators/current-user.decorator';
import { Roles } from '../../../auth/interface/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import type { RequestUser } from '../../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/interface/guards/roles.guard';
import {
  ApproveDepositUseCase,
  CancelDepositUseCase,
  CancelWithdrawalUseCase,
  GetAlertsUseCase,
  GetDepositProofUseCase,
  GetPaymentsConfigUseCase,
  GetTreasuryUseCase,
  ListMyPaymentsUseCase,
  ListPaymentsForAdminUseCase,
  MarkWithdrawalPaidUseCase,
  RejectDepositUseCase,
  RejectWithdrawalUseCase,
  RequestDepositUseCase,
  RequestWithdrawalUseCase,
  ResolveAlertUseCase,
} from '../../application/use-cases/payment-use-cases';
import {
  AdminDepositDto,
  AdminRequestsQueryDto,
  AdminWithdrawalDto,
  ApproveDepositDto,
  CreateDepositDto,
  CreateWithdrawalDto,
  MyDepositDto,
  MyWithdrawalDto,
  PayoutDto,
  ReasonDto,
} from './dto/payments.dto';

const MAX_PROOF_BYTES = 2 * 1024 * 1024;
/** Mover dinero es sensible: además del límite general, tope bajo de pedidos por minuto. */
const MONEY_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly getConfig: GetPaymentsConfigUseCase,
    private readonly listMine: ListMyPaymentsUseCase,
    private readonly requestDeposit: RequestDepositUseCase,
    private readonly cancelDeposit: CancelDepositUseCase,
    private readonly requestWithdrawal: RequestWithdrawalUseCase,
    private readonly cancelWithdrawal: CancelWithdrawalUseCase,
    private readonly listForAdmin: ListPaymentsForAdminUseCase,
    private readonly getProof: GetDepositProofUseCase,
    private readonly approveDeposit: ApproveDepositUseCase,
    private readonly rejectDeposit: RejectDepositUseCase,
    private readonly markPaid: MarkWithdrawalPaidUseCase,
    private readonly rejectWithdrawal: RejectWithdrawalUseCase,
    private readonly treasury: GetTreasuryUseCase,
    private readonly alerts: GetAlertsUseCase,
    private readonly resolveAlert: ResolveAlertUseCase,
  ) {}

  // ---------------------------------------------------------------- jugador

  /** Límites y dónde pagar. */
  @Get('config')
  config() {
    return this.getConfig.execute();
  }

  @Get('me')
  async mine(@CurrentUser() user: RequestUser) {
    const { deposits, withdrawals } = await this.listMine.execute(user.userId);
    return {
      deposits: deposits.map(MyDepositDto.from),
      withdrawals: withdrawals.map(MyWithdrawalDto.from),
    };
  }

  /** Pide una recarga: monto, método, número de operación y la foto del comprobante. */
  @Post('deposits')
  @Throttle(MONEY_THROTTLE)
  @UseInterceptors(
    FileInterceptor('proof', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PROOF_BYTES, files: 1 },
    }),
  )
  async createDeposit(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDepositDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const deposit = await this.requestDeposit.execute(user, dto, {
      data: file?.buffer ?? Buffer.alloc(0),
    });
    return MyDepositDto.from(deposit);
  }

  @Post('deposits/:id/cancel')
  @HttpCode(200)
  async cancelMyDeposit(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return MyDepositDto.from(await this.cancelDeposit.execute(user, id));
  }

  @Post('withdrawals')
  @Throttle(MONEY_THROTTLE)
  async createWithdrawal(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return MyWithdrawalDto.from(
      await this.requestWithdrawal.execute(user, dto),
    );
  }

  @Post('withdrawals/:id/cancel')
  @HttpCode(200)
  async cancelMyWithdrawal(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return MyWithdrawalDto.from(await this.cancelWithdrawal.execute(user, id));
  }

  // ------------------------------------------------------------------ admin

  @Get('admin/requests')
  @Roles('admin')
  async adminRequests(@Query() query: AdminRequestsQueryDto) {
    const pendingOnly = (query.view ?? 'pending') === 'pending';
    const { deposits, withdrawals } = await this.listForAdmin.execute(
      pendingOnly
        ? { depositStatuses: ['pending'], withdrawalStatuses: ['pending'] }
        : {},
    );
    return {
      deposits: deposits.map(AdminDepositDto.from),
      withdrawals: withdrawals.map(AdminWithdrawalDto.from),
    };
  }

  /**
   * La imagen del comprobante, solo para admins. Se sirve con el tipo REAL
   * detectado al subirla y con `nosniff`, para que el navegador nunca la
   * interprete como página o script.
   */
  @Get('admin/deposits/:id/proof')
  @Roles('admin')
  async proof(@Param('id') id: string, @Res() res: Response) {
    const proof = await this.getProof.execute(id);
    res.set({
      'Content-Type': proof.contentType,
      'Content-Length': String(proof.data.length),
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
    });
    res.end(proof.data);
  }

  @Post('admin/deposits/:id/approve')
  @HttpCode(200)
  @Roles('admin')
  async approve(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body() dto: ApproveDepositDto,
  ) {
    return AdminDepositDto.from(
      await this.approveDeposit.execute(admin.userId, id, dto),
    );
  }

  @Post('admin/deposits/:id/reject')
  @HttpCode(200)
  @Roles('admin')
  async reject(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ) {
    return AdminDepositDto.from(
      await this.rejectDeposit.execute(admin.userId, id, dto.reason),
    );
  }

  @Post('admin/withdrawals/:id/pay')
  @HttpCode(200)
  @Roles('admin')
  async pay(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body() dto: PayoutDto,
  ) {
    return AdminWithdrawalDto.from(
      await this.markPaid.execute(admin.userId, id, dto.payoutReference),
    );
  }

  @Post('admin/withdrawals/:id/reject')
  @HttpCode(200)
  @Roles('admin')
  async rejectWd(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ) {
    return AdminWithdrawalDto.from(
      await this.rejectWithdrawal.execute(admin.userId, id, dto.reason),
    );
  }

  @Get('admin/treasury')
  @Roles('admin')
  treasurySnapshot() {
    return this.treasury.execute();
  }

  @Get('admin/alerts')
  @Roles('admin')
  async adminAlerts() {
    return (await this.alerts.execute()).map((a) => ({
      ...a,
      at: a.at.toISOString(),
    }));
  }

  @Post('admin/alerts/:id/resolve')
  @HttpCode(200)
  @Roles('admin')
  async resolve(@CurrentUser() admin: RequestUser, @Param('id') id: string) {
    await this.resolveAlert.execute(admin.userId, id);
    return { ok: true };
  }
}
