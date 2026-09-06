import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SteamPriceCacheEntry,
  SteamPriceCacheRepository,
} from '../../domain/ports/steam-price-cache.repository.port';
import { SteamPriceCacheOrmEntity } from './orm/steam-price-cache.orm-entity';

@Injectable()
export class TypeOrmSteamPriceCacheRepository implements SteamPriceCacheRepository {
  constructor(
    @InjectRepository(SteamPriceCacheOrmEntity)
    private readonly repo: Repository<SteamPriceCacheOrmEntity>,
  ) {}

  async get(marketHashName: string): Promise<SteamPriceCacheEntry | null> {
    const row = await this.repo.findOne({ where: { marketHashName } });
    return row ? { marketHashName: row.marketHashName, price: row.price, lastSyncedAt: row.lastSyncedAt } : null;
  }

  async set(marketHashName: string, price: number | null): Promise<void> {
    const row = this.repo.create({ marketHashName, price, lastSyncedAt: new Date() });
    await this.repo.save(row);
  }

  async getAllMarketHashNames(): Promise<string[]> {
    const rows = await this.repo.find({ select: { marketHashName: true } });
    return rows.map((row) => row.marketHashName);
  }
}
