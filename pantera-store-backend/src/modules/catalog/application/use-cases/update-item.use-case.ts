import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { Item, ItemCategory, Rarity } from '../../domain/entities/item.entity';
import {
  ITEM_REPOSITORY,
  type ItemRepository,
} from '../../domain/ports/item.repository.port';

export interface UpdateItemInput {
  name?: string;
  hero?: string | null;
  category?: ItemCategory;
  rarity?: Rarity;
  description?: string | null;
  imageUrl?: string | null;
  steamMarketHashName?: string | null;
  stock?: number;
  published?: boolean;
}

/** Edición manual de los datos generales de un item (no toca precio/markup, que tienen su propio caso de uso). */
@Injectable()
export class UpdateItemUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
  ) {}

  async execute(id: string, input: UpdateItemInput): Promise<Item> {
    const item = await this.items.findById(id);
    if (!item) {
      throw new EntityNotFoundException('Item', id);
    }

    if (input.name !== undefined) item.updateName(input.name);
    if (input.hero !== undefined) item.updateHero(input.hero ?? undefined);
    if (input.category !== undefined) item.updateCategory(input.category);
    if (input.rarity !== undefined) item.updateRarity(input.rarity);
    if (input.description !== undefined)
      item.updateDescription(input.description ?? undefined);
    if (input.imageUrl !== undefined)
      item.updateImageUrl(input.imageUrl ?? undefined);
    if (input.steamMarketHashName !== undefined) {
      item.updateSteamMarketHashName(input.steamMarketHashName ?? undefined);
    }
    if (input.stock !== undefined) item.updateStock(input.stock);
    if (input.published !== undefined) item.updatePublished(input.published);

    await this.items.save(item);
    return item;
  }
}
