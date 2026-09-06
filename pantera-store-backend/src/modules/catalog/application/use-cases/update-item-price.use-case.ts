import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { Item } from '../../domain/entities/item.entity';
import { type ItemRepository, ITEM_REPOSITORY } from '../../domain/ports/item.repository.port';

/**
 * Caso de uso exclusivo del panel de administración: fijar (o quitar) el
 * precio final de venta a mano, en vez de calcularlo por markup. Si price es
 * null, el item vuelve a usar el cálculo por markup (global/rareza/item).
 */
@Injectable()
export class UpdateItemPriceUseCase {
  constructor(@Inject(ITEM_REPOSITORY) private readonly items: ItemRepository) {}

  async execute(itemId: string, price: number | null): Promise<Item> {
    const item = await this.items.findById(itemId);
    if (!item) {
      throw new EntityNotFoundException('Item', itemId);
    }

    item.updateManualPriceOverride(price);
    await this.items.save(item);
    return item;
  }
}
