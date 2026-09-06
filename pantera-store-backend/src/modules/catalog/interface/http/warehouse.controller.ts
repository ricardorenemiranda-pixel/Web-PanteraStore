import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/interface/guards/roles.guard';
import { Roles } from '../../../auth/interface/decorators/roles.decorator';
import { AddWarehouseAccountUseCase } from '../../application/use-cases/add-warehouse-account.use-case';
import { ListItemsUseCase } from '../../application/use-cases/list-items.use-case';
import { ListWarehouseAccountsUseCase } from '../../application/use-cases/list-warehouse-accounts.use-case';
import { RemoveWarehouseAccountUseCase } from '../../application/use-cases/remove-warehouse-account.use-case';
import { SyncWarehouseCatalogUseCase } from '../../application/use-cases/sync-warehouse-catalog.use-case';
import { AddWarehouseAccountDto } from './dto/warehouse-account.dto';
import { WarehouseAccountResponseDto } from './dto/warehouse-account-response.dto';
import { ItemResponseDto } from './dto/item-response.dto';

/** Gestión de las cuentas de Steam que la empresa usa como "almacén" — solo admin, nunca lo ven los usuarios. */
@Controller('warehouse')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class WarehouseController {
  constructor(
    private readonly listAccounts: ListWarehouseAccountsUseCase,
    private readonly addAccount: AddWarehouseAccountUseCase,
    private readonly removeAccount: RemoveWarehouseAccountUseCase,
    private readonly syncCatalog: SyncWarehouseCatalogUseCase,
    private readonly listItems: ListItemsUseCase,
  ) {}

  /** Items nuevos que trajo el sync de almacén y todavía no aprobó el admin. */
  @Get('pending-items')
  async pendingItems(): Promise<ItemResponseDto[]> {
    const items = await this.listItems.execute({ published: false });
    return items.map(ItemResponseDto.fromDomain);
  }

  @Get('accounts')
  async list(): Promise<WarehouseAccountResponseDto[]> {
    const accounts = await this.listAccounts.execute();
    return accounts.map(WarehouseAccountResponseDto.fromDomain);
  }

  @Post('accounts')
  async add(@Body() dto: AddWarehouseAccountDto): Promise<WarehouseAccountResponseDto> {
    const account = await this.addAccount.execute(dto);
    return WarehouseAccountResponseDto.fromDomain(account);
  }

  @Delete('accounts/:id')
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    await this.removeAccount.execute(id);
    return { ok: true };
  }

  @Post('sync')
  async sync(): Promise<{ ok: true }> {
    await this.syncCatalog.execute();
    return { ok: true };
  }
}
