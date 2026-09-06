import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../domain/entities/user.entity';

export const ROLES_KEY = 'roles';

/** Marca un endpoint como restringido a ciertos roles. Se lee en RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
