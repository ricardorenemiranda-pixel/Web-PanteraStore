import { WarehouseAccount } from '../../../domain/entities/warehouse-account.entity';

export class WarehouseAccountResponseDto {
  id: string;
  steamId: string;
  label: string;
  addedAt: string;

  static fromDomain(account: WarehouseAccount): WarehouseAccountResponseDto {
    const dto = new WarehouseAccountResponseDto();
    dto.id = account.id;
    dto.steamId = account.steamId;
    dto.label = account.label;
    dto.addedAt = account.addedAt.toISOString();
    return dto;
  }
}
