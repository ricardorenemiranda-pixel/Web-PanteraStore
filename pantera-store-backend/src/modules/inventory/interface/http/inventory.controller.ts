import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../auth/interface/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import type { RequestUser } from '../../../auth/interface/guards/jwt-auth.guard';
import { GetSellableInventoryUseCase } from '../../application/use-cases/get-sellable-inventory.use-case';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly getSellableInventory: GetSellableInventoryUseCase) {}

  /**
   * El inventario real de Dota 2 del usuario logueado, filtrado a lo que se
   * puede vender. Se sirve desde caché (1h) salvo que se pida ?refresh=true
   * (ej. el usuario clickeó "Actualizar inventario" porque hizo un trade).
   */
  @Get('me')
  async me(@CurrentUser() user: RequestUser, @Query('refresh') refresh?: string) {
    if (!user.steamId) {
      throw new ForbiddenException('Vincula tu cuenta de Steam para ver tu inventario.');
    }
    return this.getSellableInventory.execute(user.steamId, refresh === 'true');
  }
}
