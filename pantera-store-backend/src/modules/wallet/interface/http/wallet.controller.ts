import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../auth/interface/decorators/current-user.decorator';
import { Roles } from '../../../auth/interface/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import type { RequestUser } from '../../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/interface/guards/roles.guard';
import {
  CreditTestBalanceUseCase,
  LookupWalletUserUseCase,
} from '../../application/use-cases/admin-test-balance.use-cases';
import { GrantBonusUseCase } from '../../application/use-cases/grant-bonus.use-case';
import {
  GetPlatformWalletUseCase,
  GetWalletUseCase,
} from '../../application/use-cases/get-wallet.use-case';
import {
  CreditTestBalanceDto,
  GrantBonusDto,
  LedgerEntryResponseDto,
  ListEntriesQueryDto,
  LookupUserQueryDto,
  WalletResponseDto,
  WalletUserResponseDto,
  WalletViewResponseDto,
} from './dto/wallet.dto';

/**
 * Ojo: acá NO hay endpoint para que un usuario bloquee, cobre o se pague a sí
 * mismo. Esas operaciones (stake-operations.use-cases) solo las llama el
 * backend cuando ocurre algo real, como unirse a una sala.
 */
@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletController {
  constructor(
    private readonly getWallet: GetWalletUseCase,
    private readonly getPlatformWallet: GetPlatformWalletUseCase,
    private readonly lookupUser: LookupWalletUserUseCase,
    private readonly creditTestBalance: CreditTestBalanceUseCase,
    private readonly grantBonus: GrantBonusUseCase,
  ) {}

  /** Mi saldo (disponible y bloqueado) y mi historial de movimientos. */
  @Get('me')
  async mine(
    @CurrentUser() user: RequestUser,
    @Query() query: ListEntriesQueryDto,
  ) {
    const view = await this.getWallet.execute(user.userId, query);
    return WalletViewResponseDto.fromDomain(view);
  }

  /** Panel de admin: buscar un jugador (id, SteamID64 o email) y ver su billetera. */
  @Get('admin/lookup')
  @Roles('admin')
  async lookup(@Query() query: LookupUserQueryDto) {
    const view = await this.lookupUser.execute(query.q);
    return {
      user: WalletUserResponseDto.fromDomain(view.user),
      ...WalletViewResponseDto.fromDomain(view, true),
    };
  }

  /** Panel de admin: la caja de la plataforma (comisiones cobradas) y sus movimientos. */
  @Get('admin/platform')
  @Roles('admin')
  async platform(@Query() query: ListEntriesQueryDto) {
    return WalletViewResponseDto.fromDomain(
      await this.getPlatformWallet.execute(query),
      true,
    );
  }

  /** Panel de admin: acreditar saldo de prueba. */
  @Post('admin/test-credit')
  @Roles('admin')
  async testCredit(
    @CurrentUser() admin: RequestUser,
    @Body() dto: CreditTestBalanceDto,
  ) {
    const result = await this.creditTestBalance.execute({
      adminId: admin.userId,
      ...dto,
    });
    return {
      user: WalletUserResponseDto.fromDomain(result.user),
      wallet: WalletResponseDto.fromDomain(result.wallet),
      entry: LedgerEntryResponseDto.fromDomain(result.entry, true),
      replayed: result.replayed,
    };
  }

  /** Panel de admin: otorgar un bono real (a diferencia de test-credit, este queda anunciado en el feed público). */
  @Post('admin/bonus')
  @Roles('admin')
  async bonus(@CurrentUser() admin: RequestUser, @Body() dto: GrantBonusDto) {
    const result = await this.grantBonus.execute({ adminId: admin.userId, ...dto });
    return {
      user: WalletUserResponseDto.fromDomain(result.user),
      wallet: WalletResponseDto.fromDomain(result.wallet),
      entry: LedgerEntryResponseDto.fromDomain(result.entry, true),
      replayed: result.replayed,
    };
  }
}
