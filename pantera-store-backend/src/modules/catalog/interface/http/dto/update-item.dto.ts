import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
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

/** Todo opcional: solo se actualiza lo que venga en el body. `null` limpia el campo (donde aplica). */
export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  hero?: string | null;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: ItemCategory;

  @IsOptional()
  @IsIn(RARITIES)
  rarity?: Rarity;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  steamMarketHashName?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
