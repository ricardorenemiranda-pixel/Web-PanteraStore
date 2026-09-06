import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { InventoryItem } from '../../domain/ports/inventory.port';
import {
  CachedUserInventory,
  UserInventoryCacheRepository,
} from '../../domain/ports/user-inventory-cache.repository.port';
import { UserInventoryCacheOrmEntity } from './orm/user-inventory-cache.orm-entity';

@Injectable()
export class TypeOrmUserInventoryCacheRepository implements UserInventoryCacheRepository {
  constructor(
    @InjectRepository(UserInventoryCacheOrmEntity)
    private readonly repo: Repository<UserInventoryCacheOrmEntity>,
  ) {}

  async get(steamId: string): Promise<CachedUserInventory | null> {
    const row = await this.repo.findOne({ where: { steamId } });
    return row ? { items: row.items, scannedAt: row.scannedAt } : null;
  }

  async set(steamId: string, items: InventoryItem[]): Promise<void> {
    const row = this.repo.create({ steamId, items, scannedAt: new Date() });
    await this.repo.save(row);
  }
}
