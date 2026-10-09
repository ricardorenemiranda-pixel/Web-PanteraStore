import { Inject, Injectable } from '@nestjs/common';
import { Item, ItemCategory, Rarity } from '../../domain/entities/item.entity';
import {
  ITEM_REPOSITORY,
  type ItemRepository,
} from '../../domain/ports/item.repository.port';

export interface CreateItemInput {
  name: string;
  hero?: string;
  category: ItemCategory;
  rarity: Rarity;
  description?: string;
  imageUrl?: string;
  steamMarketHashName: string;
  marketPrice: number;
  stock: number;
}

/** Alta manual de un item del catálogo — el admin carga todo a mano, no hay sync de por medio. */
@Injectable()
export class CreateItemUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
  ) {}

  async execute(input: CreateItemInput): Promise<Item> {
    const id = await this.uniqueSlugFor(input.name);
    const referenceCode = await this.uniqueReferenceCode();
    const item = Item.create({
      id,
      referenceCode,
      name: input.name,
      hero: input.hero,
      category: input.category,
      rarity: input.rarity,
      description: input.description,
      imageUrl: input.imageUrl,
      steamMarketHashName: input.steamMarketHashName,
      marketPrice: input.marketPrice,
      markupPercentOverride: null,
      dateAdded: new Date(),
      stock: input.stock,
      published: true,
    });
    await this.items.save(item);
    return item;
  }

  /** Código corto de 7 dígitos para que el admin ubique el item rápido (ej. por WhatsApp). */
  private async uniqueReferenceCode(): Promise<string> {
    let candidate: string;
    do {
      candidate = String(Math.floor(1_000_000 + Math.random() * 9_000_000));
    } while (await this.items.findByReferenceCode(candidate));
    return candidate;
  }

  private async uniqueSlugFor(name: string): Promise<string> {
    const base = this.slugify(name);
    let candidate = base;
    let suffix = 2;
    while (await this.items.findById(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private slugify(input: string): string {
    const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(COMBINING_MARKS, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
