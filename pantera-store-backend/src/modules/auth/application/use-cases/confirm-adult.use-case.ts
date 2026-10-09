import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { User } from '../../domain/entities/user.entity';
import { USER_REPOSITORY, type UserRepository } from '../../domain/ports/user.repository.port';

/** El usuario declara su fecha de nacimiento; solo si es mayor de 18 queda habilitado para jugar con dinero. */
@Injectable()
export class ConfirmAdultUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: string, birthDate: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new EntityNotFoundException('User', userId);
    user.confirmAdult(birthDate);
    await this.users.save(user);
    return user;
  }
}
