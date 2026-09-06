import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../auth/interface/decorators/current-user.decorator';
import { Roles } from '../../../auth/interface/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/interface/guards/roles.guard';
import type { RequestUser } from '../../../auth/interface/guards/jwt-auth.guard';
import { USER_REPOSITORY, type UserRepository } from '../../../auth/domain/ports/user.repository.port';
import { CreateSaleOrderUseCase } from '../../application/use-cases/create-sale-order.use-case';
import { ListMyOrdersUseCase } from '../../application/use-cases/list-my-orders.use-case';
import { ListSaleOrdersUseCase } from '../../application/use-cases/list-sale-orders.use-case';
import { ReviewSaleOrderUseCase } from '../../application/use-cases/review-sale-order.use-case';
import { CreateSaleOrderDto } from './dto/create-sale-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { SaleOrderResponseDto } from './dto/sale-order-response.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(
    private readonly createSaleOrder: CreateSaleOrderUseCase,
    private readonly reviewSaleOrder: ReviewSaleOrderUseCase,
    private readonly listSaleOrders: ListSaleOrdersUseCase,
    private readonly listMyOrders: ListMyOrdersUseCase,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  /** Cualquier usuario logueado con Steam puede crear su propia orden de venta. */
  @Post()
  async create(@CurrentUser() requestUser: RequestUser, @Body() dto: CreateSaleOrderDto) {
    if (!requestUser.steamId) {
      throw new ForbiddenException('Vincula tu cuenta de Steam para vender items.');
    }
    const user = await this.users.findById(requestUser.userId);
    const order = await this.createSaleOrder.execute({
      userSteamId: requestUser.steamId,
      userDisplayName: user?.displayName ?? requestUser.steamId,
      tradeUrl: dto.tradeUrl,
      itemIds: dto.itemIds,
    });
    return SaleOrderResponseDto.fromDomain(order);
  }

  /** "Mis compras": historial de órdenes propio, cualquier usuario logueado. */
  @Get('me')
  async listMine(@CurrentUser() user: RequestUser) {
    if (!user.steamId) {
      return [];
    }
    const orders = await this.listMyOrders.execute(user.steamId);
    return orders.map(SaleOrderResponseDto.fromDomain);
  }

  /** Panel de administración: ver todas las órdenes (opcionalmente filtradas por estado). */
  @Get()
  @Roles('admin')
  async list(@Query() query: ListOrdersQueryDto) {
    const orders = await this.listSaleOrders.execute(query.status);
    return orders.map(SaleOrderResponseDto.fromDomain);
  }

  @Patch(':id/approve')
  @Roles('admin')
  async approve(@Param('id') id: string) {
    const order = await this.reviewSaleOrder.approve(id);
    return SaleOrderResponseDto.fromDomain(order);
  }

  @Patch(':id/reject')
  @Roles('admin')
  async reject(@Param('id') id: string) {
    const order = await this.reviewSaleOrder.reject(id);
    return SaleOrderResponseDto.fromDomain(order);
  }
}
