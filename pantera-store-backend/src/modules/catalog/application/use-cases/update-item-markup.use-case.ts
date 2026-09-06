import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { Item } from '../../domain/entities/item.entity';
import { type ItemRepository, ITEM_REPOSITORY } from '../../domain/ports/item.repository.port';

/**
 * Caso de uso exclusivo del panel de administración: fijar (o quitar) el
 * markup específico de un item. Si markupPercent es null, el item vuelve a
 * usar el markup global.
 */
@Injectable()
export class UpdateItemMarkupUseCase {
  constructor(@Inject(ITEM_REPOSITORY) private readonly items: ItemRepository) {}

  async execute(itemId: string, markupPercent: number | null): Promise<Item> {
    const item = await this.items.findById(itemId);
    if (!item) {
      throw new EntityNotFoundException('Item', itemId);
    }

    item.updateMarkupOverride(markupPercent);
    await this.items.save(item);
    return item;
  }
}
