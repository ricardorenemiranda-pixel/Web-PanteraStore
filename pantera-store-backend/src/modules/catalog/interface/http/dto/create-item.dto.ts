import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';
import type {
  ItemCategory,
  Rarity,
} from '../../../domain/entities/item.entity';

const CATEGORIES: ItemCategory[] = ['hero', 'courier', 'weather', 'treasure'];
const RARITIES: Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'mythical',
  'legendary',
  'immortal',
  'arcana',
  'ancient',
];

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  hero?: string;

  @IsIn(CATEGORIES)
  category!: ItemCategory;

  @IsIn(RARITIES)
  rarity!: Rarity;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsString()
  @MinLength(1)
  steamMarketHashName!: string;

  @IsNumber()
  @Min(0)
  marketPrice!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}
