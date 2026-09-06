import { IsString, Matches, MinLength } from 'class-validator';

const STEAM_ID64_PATTERN = /^\d{17}$/;

export class AddWarehouseAccountDto {
  @IsString()
  @Matches(STEAM_ID64_PATTERN, { message: 'steamId debe ser un SteamID64 válido (17 dígitos).' })
  steamId!: string;

  @IsString()
  @MinLength(1)
  label!: string;
}
