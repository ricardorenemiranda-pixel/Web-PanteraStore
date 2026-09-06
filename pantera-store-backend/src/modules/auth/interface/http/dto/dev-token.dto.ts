import { IsIn } from 'class-validator';
import type { UserRole } from '../../../domain/entities/user.entity';

export class DevTokenDto {
  @IsIn(['customer', 'admin'])
  role!: UserRole;
}
