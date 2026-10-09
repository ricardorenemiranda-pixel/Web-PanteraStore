import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import {
  ITEM_REPOSITORY,
  type ItemRepository,
} from '../../domain/ports/item.repository.port';

@Injectable()
export class DeleteItemUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const item = await this.items.findById(id);
    if (!item) {
      throw new EntityNotFoundException('Item', id);
    }
    await this.items.delete(id);
  }
}
