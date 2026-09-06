import { IsString, Matches } from 'class-validator';

const STEAM_TRADE_URL_REGEX =
  /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=\w+$/;

export class UpdateTradeUrlDto {
  @IsString()
  @Matches(STEAM_TRADE_URL_REGEX, {
    message: 'tradeUrl debe ser un link válido de steamcommunity.com/tradeoffer/new/...',
  })
  tradeUrl!: string;
}
