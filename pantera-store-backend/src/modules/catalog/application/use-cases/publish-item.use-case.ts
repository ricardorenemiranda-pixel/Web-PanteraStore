import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { Item } from '../../domain/entities/item.entity';
import { type ItemRepository, ITEM_REPOSITORY } from '../../domain/ports/item.repository.port';

/**
 * Caso de uso exclusivo del panel de administración: el admin ya revisó el
 * precio de un item nuevo (traído por el sync de almacén) y lo aprueba para
 * que salga en el catálogo público.
 */
@Injectable()
export class PublishItemUseCase {
  constructor(@Inject(ITEM_REPOSITORY) private readonly items: ItemRepository) {}

  async execute(itemId: string): Promise<Item> {
    const item = await this.items.findById(itemId);
    if (!item) {
      throw new EntityNotFoundException('Item', itemId);
    }

    item.publish();
    await this.items.save(item);
    return item;
  }
}
