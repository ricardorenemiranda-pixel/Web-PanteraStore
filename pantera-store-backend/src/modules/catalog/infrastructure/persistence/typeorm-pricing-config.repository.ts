import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PricingConfigRepository,
  SellableRarity,
} from '../../domain/ports/pricing-config.repository.port';
import { PricingConfigOrmEntity } from './orm/pricing-config.orm-entity';

const SINGLETON_ID = 'singleton';

const RARITY_COLUMN: Record<SellableRarity, keyof PricingConfigOrmEntity> = {
  mythical: 'markupPercentMythical',
  legendary: 'markupPercentLegendary',
  immortal: 'markupPercentImmortal',
  arcana: 'markupPercentArcana',
};

@Injectable()
export class TypeOrmPricingConfigRepository implements PricingConfigRepository {
  constructor(
    @InjectRepository(PricingConfigOrmEntity)
    private readonly repo: Repository<PricingConfigOrmEntity>,
  ) {}

  async getGlobalMarkupPercent(): Promise<number> {
    return (await this.getOrCreateRow()).globalMarkupPercent;
  }

  async setGlobalMarkupPercent(percent: number): Promise<void> {
    await this.update({ globalMarkupPercent: percent });
  }

  async getBuybackDiscountPercent(): Promise<number> {
    return (await this.getOrCreateRow()).buybackDiscountPercent;
  }

  async setBuybackDiscountPercent(percent: number): Promise<void> {
    await this.update({ buybackDiscountPercent: percent });
  }

  async getMarkupPercentByRarity(rarity: SellableRarity): Promise<number | null> {
    const row = await this.getOrCreateRow();
    return row[RARITY_COLUMN[rarity]] as number | null;
  }

  async setMarkupPercentByRarity(rarity: SellableRarity, percent: number | null): Promise<void> {
    await this.update({ [RARITY_COLUMN[rarity]]: percent });
  }

  async getAllRarityMarkups(): Promise<Record<SellableRarity, number | null>> {
    const row = await this.getOrCreateRow();
    return {
      mythical: row.markupPercentMythical,
      legendary: row.markupPercentLegendary,
      immortal: row.markupPercentImmortal,
      arcana: row.markupPercentArcana,
    };
  }

  async getSyncIntervalDays(): Promise<number> {
    return (await this.getOrCreateRow()).syncIntervalDays;
  }

  async setSyncIntervalDays(days: number): Promise<void> {
    await this.update({ syncIntervalDays: days });
  }

  async getLastFullSyncAt(): Promise<Date | null> {
    return (await this.getOrCreateRow()).lastFullSyncAt;
  }

  async setLastFullSyncAt(date: Date): Promise<void> {
    await this.update({ lastFullSyncAt: date });
  }

  private async getOrCreateRow(): Promise<PricingConfigOrmEntity> {
    const existing = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    if (existing) return existing;

    const row = this.repo.create({ id: SINGLETON_ID });
    return this.repo.save(row);
  }

  private async update(partial: Partial<PricingConfigOrmEntity>): Promise<void> {
    const row = await this.getOrCreateRow();
    Object.assign(row, partial);
    await this.repo.save(row);
  }
}
