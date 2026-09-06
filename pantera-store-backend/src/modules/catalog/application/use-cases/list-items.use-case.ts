import { Inject, Injectable } from '@nestjs/common';
import {
  type ItemFilter,
  type ItemRepository,
  ITEM_REPOSITORY,
} from '../../domain/ports/item.repository.port';
import {
  type PricingConfigRepository,
  PRICING_CONFIG_REPOSITORY,
} from '../../domain/ports/pricing-config.repository.port';
import { ItemWithPrice } from '../dto/item-with-price.dto';
import { resolveMarkupPercent } from '../resolve-markup-percent';

@Injectable()
export class ListItemsUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
  ) {}

  async execute(filter?: ItemFilter): Promise<ItemWithPrice[]> {
    const [items, globalMarkup, buybackDiscount, rarityMarkups] = await Promise.all([
      this.items.findAll(filter),
      this.pricingConfig.getGlobalMarkupPercent(),
      this.pricingConfig.getBuybackDiscountPercent(),
      this.pricingConfig.getAllRarityMarkups(),
    ]);

    return items.map((item) => {
      const markup = resolveMarkupPercent(item.rarity, rarityMarkups, globalMarkup);
      return new ItemWithPrice(item, item.sellPrice(markup), item.buybackPrice(markup, buybackDiscount));
    });
  }
}
