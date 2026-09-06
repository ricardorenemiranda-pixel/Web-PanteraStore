import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../../auth/interface/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/interface/guards/roles.guard';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { GetItemUseCase } from '../../application/use-cases/get-item.use-case';
import { GetPricingConfigUseCase } from '../../application/use-cases/get-pricing-config.use-case';
import { ListItemsUseCase } from '../../application/use-cases/list-items.use-case';
import { PublishItemUseCase } from '../../application/use-cases/publish-item.use-case';
import { SyncAllPricesUseCase } from '../../application/use-cases/sync-all-prices.use-case';
import { SyncItemPriceUseCase } from '../../application/use-cases/sync-item-price.use-case';
import { UpdateGlobalMarkupUseCase } from '../../application/use-cases/update-global-markup.use-case';
import { UpdateItemMarkupUseCase } from '../../application/use-cases/update-item-markup.use-case';
import { UpdateItemPriceUseCase } from '../../application/use-cases/update-item-price.use-case';
import { UpdateRarityMarkupUseCase } from '../../application/use-cases/update-rarity-markup.use-case';
import { UpdateSyncIntervalUseCase } from '../../application/use-cases/update-sync-interval.use-case';
import { ItemResponseDto } from './dto/item-response.dto';
import { ListItemsQueryDto } from './dto/list-items-query.dto';
import {
  UpdateGlobalMarkupDto,
  UpdateItemMarkupDto,
  UpdateItemPriceDto,
  UpdateRarityMarkupDto,
  UpdateSyncIntervalDto,
} from './dto/update-markup.dto';

@Controller('items')
export class CatalogController {
  constructor(
    private readonly listItems: ListItemsUseCase,
    private readonly getItem: GetItemUseCase,
    private readonly updateItemMarkup: UpdateItemMarkupUseCase,
    private readonly updateGlobalMarkup: UpdateGlobalMarkupUseCase,
    private readonly syncItemPrice: SyncItemPriceUseCase,
    private readonly getPricingConfig: GetPricingConfigUseCase,
    private readonly updateRarityMarkup: UpdateRarityMarkupUseCase,
    private readonly updateSyncInterval: UpdateSyncIntervalUseCase,
    private readonly syncAllPrices: SyncAllPricesUseCase,
    private readonly updateItemPrice: UpdateItemPriceUseCase,
    private readonly publishItem: PublishItemUseCase,
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

  @Post('config/sync-now')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async syncNow() {
    await this.syncAllPrices.execute();
    return { ok: true };
  }

  @Patch('config/rarity-markup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setRarityMarkup(@Body() dto: UpdateRarityMarkupDto) {
    await this.updateRarityMarkup.execute(dto.rarity, dto.markupPercent ?? null);
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
  async setItemMarkup(@Param('id') id: string, @Body() dto: UpdateItemMarkupDto) {
    const item = await this.updateItemMarkup.execute(id, dto.markupPercent ?? null);
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
}
