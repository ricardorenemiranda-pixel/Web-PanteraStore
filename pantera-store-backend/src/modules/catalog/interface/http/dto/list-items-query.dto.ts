import { IsIn, IsOptional, IsString } from 'class-validator';
import type { ItemCategory, Rarity } from '../../../domain/entities/item.entity';

const CATEGORIES: ItemCategory[] = ['hero', 'courier', 'weather'];
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

/**
 * Primera capa de seguridad del lado HTTP: nada de lo que venga en la query
 * llega al caso de uso sin pasar por acá. class-validator rechaza cualquier
 * valor fuera de lo esperado antes de que toque una sola línea de negocio.
 */
export class ListItemsQueryDto {
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: ItemCategory;

  @IsOptional()
  @IsIn(RARITIES)
  rarity?: Rarity;

  @IsOptional()
  @IsString()
  hero?: string;
}
