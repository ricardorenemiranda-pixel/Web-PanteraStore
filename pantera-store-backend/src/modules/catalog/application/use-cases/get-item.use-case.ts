import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { type ItemRepository, ITEM_REPOSITORY } from '../../domain/ports/item.repository.port';
import {
  type PricingConfigRepository,
  PRICING_CONFIG_REPOSITORY,
} from '../../domain/ports/pricing-config.repository.port';
import { ItemWithPrice } from '../dto/item-with-price.dto';
import { resolveMarkupPercent } from '../resolve-markup-percent';

@Injectable()
export class GetItemUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
  ) {}

  async execute(id: string): Promise<ItemWithPrice> {
    const item = await this.items.findById(id);
    if (!item) {
      throw new EntityNotFoundException('Item', id);
    }

    const [globalMarkup, buybackDiscount, rarityMarkups] = await Promise.all([
      this.pricingConfig.getGlobalMarkupPercent(),
      this.pricingConfig.getBuybackDiscountPercent(),
      this.pricingConfig.getAllRarityMarkups(),
    ]);

    const markup = resolveMarkupPercent(item.rarity, rarityMarkups, globalMarkup);
    return new ItemWithPrice(item, item.sellPrice(markup), item.buybackPrice(markup, buybackDiscount));
  }
}
