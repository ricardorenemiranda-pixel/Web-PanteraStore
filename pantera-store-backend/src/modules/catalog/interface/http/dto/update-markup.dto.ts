import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import type { SellableRarity } from '../../../domain/ports/pricing-config.repository.port';

const SELLABLE_RARITIES: SellableRarity[] = ['mythical', 'legendary', 'immortal', 'arcana'];

export class UpdateItemMarkupDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  markupPercent!: number | null;
}

export class UpdateGlobalMarkupDto {
  @IsNumber()
  @Min(0)
  @Max(300)
  markupPercent!: number;
}

export class UpdateRarityMarkupDto {
  @IsIn(SELLABLE_RARITIES)
  rarity!: SellableRarity;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  markupPercent!: number | null;
}

export class UpdateSyncIntervalDto {
  @IsInt()
  @Min(1)
  @Max(90)
  days!: number;
}

export class UpdateItemPriceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price!: number | null;
}
