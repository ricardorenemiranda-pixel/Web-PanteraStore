import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import {
  ITEM_REPOSITORY,
  type ItemRepository,
} from '../../../catalog/domain/ports/item.repository.port';
import {
  PRICING_CONFIG_REPOSITORY,
  type PricingConfigRepository,
} from '../../../catalog/domain/ports/pricing-config.repository.port';
import { SaleOrder } from '../../domain/entities/sale-order.entity';
import {
  type SaleOrderRepository,
  SALE_ORDER_REPOSITORY,
} from '../../domain/ports/sale-order.repository.port';

export interface CreateSaleOrderInput {
  userSteamId: string;
  userDisplayName: string;
  tradeUrl: string;
  itemIds: string[];
}

/**
 * Congela el precio de recompra vigente de cada item al momento de crear la
 * orden (para que un cambio de markup después no altere lo que ya se le
 * ofreció al usuario), y la deja en estado "pendiente" para que el panel de
 * administración la revise.
 */
@Injectable()
export class CreateSaleOrderUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
    @Inject(SALE_ORDER_REPOSITORY) private readonly orders: SaleOrderRepository,
  ) {}

  async execute(input: CreateSaleOrderInput): Promise<SaleOrder> {
    const [globalMarkup, buybackDiscount] = await Promise.all([
      this.pricingConfig.getGlobalMarkupPercent(),
      this.pricingConfig.getBuybackDiscountPercent(),
    ]);

    const lineItems = await Promise.all(
      input.itemIds.map(async (itemId) => {
        const item = await this.items.findById(itemId);
        if (!item) {
          throw new InvalidDomainStateException(`El item "${itemId}" no existe en el catálogo.`);
        }
        return {
          itemId: item.id,
          itemName: item.name,
          price: item.buybackPrice(globalMarkup, buybackDiscount),
        };
      }),
    );

    const order = SaleOrder.create({
      id: randomUUID(),
      userSteamId: input.userSteamId,
      userDisplayName: input.userDisplayName,
      tradeUrl: input.tradeUrl,
      lineItems,
    });

    await this.orders.save(order);
    return order;
  }
}
