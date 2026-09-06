import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

const STEAM_TRADE_URL_REGEX =
  /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=\w+$/;

export class RegisterDto {
  @IsString()
  @MinLength(3)
  displayName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  confirmPassword!: string;

  @IsString()
  @Matches(STEAM_TRADE_URL_REGEX, {
    message: 'tradeUrl debe ser un link válido de steamcommunity.com/tradeoffer/new/...',
  })
  tradeUrl!: string;
}
