import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Item } from '../../domain/entities/item.entity';
import { ItemFilter, ItemRepository } from '../../domain/ports/item.repository.port';
import { ItemOrmEntity } from './orm/item.orm-entity';

@Injectable()
export class TypeOrmItemRepository implements ItemRepository {
  constructor(
    @InjectRepository(ItemOrmEntity) private readonly repo: Repository<ItemOrmEntity>,
  ) {}

  async findAll(filter?: ItemFilter): Promise<Item[]> {
    const where: FindOptionsWhere<ItemOrmEntity> = {};
    if (filter?.category) where.category = filter.category;
    if (filter?.rarity) where.rarity = filter.rarity;
    if (filter?.hero) where.hero = filter.hero;
    if (filter?.published !== undefined) where.published = filter.published;

    const rows = await this.repo.find({ where });
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<Item | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByMarketHashName(marketHashName: string): Promise<Item | null> {
    const row = await this.repo.findOne({ where: { steamMarketHashName: marketHashName } });
    return row ? this.toDomain(row) : null;
  }

  async save(item: Item): Promise<void> {
    await this.repo.save(this.toOrm(item));
  }

  private toDomain(row: ItemOrmEntity): Item {
    return Item.create({
      id: row.id,
      steamMarketHashName: row.steamMarketHashName,
      name: row.name,
      hero: row.hero ?? undefined,
      category: row.category,
      rarity: row.rarity,
      marketPrice: row.marketPrice,
      markupPercentOverride: row.markupPercentOverride,
      imageUrl: row.imageUrl ?? undefined,
      dateAdded: row.dateAdded,
      stock: row.stock,
      pendingHolds: row.pendingHolds,
      manualPriceOverride: row.manualPriceOverride,
      published: row.published,
      setPieces: row.setPieces,
    });
  }

  private toOrm(item: Item): ItemOrmEntity {
    const row = new ItemOrmEntity();
    row.id = item.id;
    row.steamMarketHashName = item.steamMarketHashName;
    row.name = item.name;
    row.hero = item.hero ?? null;
    row.category = item.category;
    row.rarity = item.rarity;
    row.marketPrice = item.marketPrice;
    row.markupPercentOverride = item.markupPercentOverride;
    row.imageUrl = item.imageUrl ?? null;
    row.dateAdded = item.dateAdded;
    row.stock = item.stock;
    row.pendingHolds = item.pendingHolds;
    row.manualPriceOverride = item.manualPriceOverride;
    row.published = item.published;
    row.setPieces = item.setPieces;
    return row;
  }
}
