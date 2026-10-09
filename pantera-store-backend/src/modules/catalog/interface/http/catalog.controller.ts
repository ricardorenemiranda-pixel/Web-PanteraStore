import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../../auth/interface/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/interface/guards/roles.guard';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { CreateItemUseCase } from '../../application/use-cases/create-item.use-case';
import { DeleteItemUseCase } from '../../application/use-cases/delete-item.use-case';
import { GetItemUseCase } from '../../application/use-cases/get-item.use-case';
import { GetPricingConfigUseCase } from '../../application/use-cases/get-pricing-config.use-case';
import { ListItemsUseCase } from '../../application/use-cases/list-items.use-case';
import { PublishItemUseCase } from '../../application/use-cases/publish-item.use-case';
import { SyncAllPricesUseCase } from '../../application/use-cases/sync-all-prices.use-case';
import { SyncItemPriceUseCase } from '../../application/use-cases/sync-item-price.use-case';
import { UpdateGlobalMarkupUseCase } from '../../application/use-cases/update-global-markup.use-case';
import { UpdateItemUseCase } from '../../application/use-cases/update-item.use-case';
import { UpdateItemMarkupUseCase } from '../../application/use-cases/update-item-markup.use-case';
import { UpdateItemPriceUseCase } from '../../application/use-cases/update-item-price.use-case';
import { UpdateRarityMarkupUseCase } from '../../application/use-cases/update-rarity-markup.use-case';
import { UpdateSyncIntervalUseCase } from '../../application/use-cases/update-sync-interval.use-case';
import {
  type SteamMarketGateway,
  STEAM_MARKET_RAW_GATEWAY,
} from '../../domain/ports/steam-market.port';
import { CreateItemDto } from './dto/create-item.dto';
import { ItemResponseDto } from './dto/item-response.dto';
import { ListItemsQueryDto } from './dto/list-items-query.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import {
  UpdateGlobalMarkupDto,
  UpdateItemMarkupDto,
  UpdateItemPriceDto,
  UpdateRarityMarkupDto,
  UpdateSyncIntervalDto,
} from './dto/update-markup.dto';

@Controller('items')
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(
    private readonly listItems: ListItemsUseCase,
    private readonly getItem: GetItemUseCase,
    private readonly createItem: CreateItemUseCase,
    private readonly updateItem: UpdateItemUseCase,
    private readonly deleteItem: DeleteItemUseCase,
    private readonly updateItemMarkup: UpdateItemMarkupUseCase,
    private readonly updateGlobalMarkup: UpdateGlobalMarkupUseCase,
    private readonly syncItemPrice: SyncItemPriceUseCase,
    private readonly getPricingConfig: GetPricingConfigUseCase,
    private readonly updateRarityMarkup: UpdateRarityMarkupUseCase,
    private readonly updateSyncInterval: UpdateSyncIntervalUseCase,
    private readonly syncAllPrices: SyncAllPricesUseCase,
    private readonly updateItemPrice: UpdateItemPriceUseCase,
    private readonly publishItem: PublishItemUseCase,
    @Inject(STEAM_MARKET_RAW_GATEWAY)
    private readonly steamMarket: SteamMarketGateway,
  ) {}

  // --- Catálogo público, sin autenticación ---
  // (siempre solo items publicados — los pendientes de aprobación no salen acá)

  @Get()
  async list(@Query() query: ListItemsQueryDto): Promise<ItemResponseDto[]> {
    const items = await this.listItems.execute({ ...query, published: true });
    return items.map(ItemResponseDto.fromDomain);
  }

  // --- Panel de administración: requiere JWT + rol admin ---
  // (declarado antes de ":id" para que "config" no se interprete como un id de item)

  @Get('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getConfig() {
    return this.getPricingConfig.execute();
  }

  // Consultado en loop por el frontend mientras "Sincronizar ahora" está en
  // curso, para mostrar un % real de avance (sync-now no espera a que
  // termine — ver más abajo).
  // Cotiza en Steam Market un item que todavía no existe (formulario de
  // "Nuevo item"), para poder fijar el precio antes de crearlo.
  @Get('config/steam-quote')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async steamQuote(
    @Query('name') name: string,
  ): Promise<{ marketPrice: number | null }> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return { marketPrice: null };
    return { marketPrice: await this.steamMarket.getLowestPrice(trimmed) };
  }

  @Get('config/sync-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  syncStatus() {
    return this.syncAllPrices.getProgress();
  }

  // Todo el catálogo (publicado o no) — lo usa el panel de admin para
  // administrar el catálogo manual y para armar el PDF exportable.
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async listAllForAdmin(): Promise<ItemResponseDto[]> {
    const items = await this.listItems.execute({});
    return items.map(ItemResponseDto.fromDomain);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateItemDto): Promise<ItemResponseDto> {
    const item = await this.createItem.execute({
      ...dto,
      stock: dto.stock ?? 0,
    });
    return ItemResponseDto.fromDomain(await this.getItem.execute(item.id));
  }

  // No espera a que termine — el sync puede tardar (rate limit de Steam
  // Market) y el frontend necesita el request de vuelta ya para empezar a
  // consultar /config/sync-status y mostrar el % de avance en vivo.
  @Post('config/sync-now')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  syncNow() {
    this.syncAllPrices
      .execute()
      .catch((err) =>
        this.logger.error('Falló la sincronización de precios', err),
      );
    return { ok: true };
  }

  @Patch('config/rarity-markup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setRarityMarkup(@Body() dto: UpdateRarityMarkupDto) {
    await this.updateRarityMarkup.execute(
      dto.rarity,
      dto.markupPercent ?? null,
    );
    return { rarity: dto.rarity, markupPercent: dto.markupPercent ?? null };
  }

  @Patch('config/sync-interval')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setSyncInterval(@Body() dto: UpdateSyncIntervalDto) {
    await this.updateSyncInterval.execute(dto.days);
    return { syncIntervalDays: dto.days };
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<ItemResponseDto> {
    const itemWithPrice = await this.getItem.execute(id);
    if (!itemWithPrice.item.published) {
      throw new EntityNotFoundException('Item', id);
    }
    return ItemResponseDto.fromDomain(itemWithPrice);
  }

  @Patch(':id/markup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setItemMarkup(
    @Param('id') id: string,
    @Body() dto: UpdateItemMarkupDto,
  ) {
    const item = await this.updateItemMarkup.execute(
      id,
      dto.markupPercent ?? null,
    );
    return { id: item.id, markupPercentOverride: item.markupPercentOverride };
  }

  @Patch('config/global-markup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setGlobalMarkup(@Body() dto: UpdateGlobalMarkupDto) {
    await this.updateGlobalMarkup.execute(dto.markupPercent);
    return { globalMarkupPercent: dto.markupPercent };
  }

  @Patch(':id/sync-price')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async syncPrice(@Param('id') id: string) {
    await this.syncItemPrice.execute(id);
    const item = await this.getItem.execute(id);
    return ItemResponseDto.fromDomain(item);
  }

  @Patch(':id/price')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setItemPrice(@Param('id') id: string, @Body() dto: UpdateItemPriceDto) {
    await this.updateItemPrice.execute(id, dto.price ?? null);
    const item = await this.getItem.execute(id);
    return ItemResponseDto.fromDomain(item);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async publish(@Param('id') id: string) {
    await this.publishItem.execute(id);
    const item = await this.getItem.execute(id);
    return ItemResponseDto.fromDomain(item);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ): Promise<ItemResponseDto> {
    await this.updateItem.execute(id, dto);
    return ItemResponseDto.fromDomain(await this.getItem.execute(id));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    await this.deleteItem.execute(id);
    return { ok: true };
  }
}
