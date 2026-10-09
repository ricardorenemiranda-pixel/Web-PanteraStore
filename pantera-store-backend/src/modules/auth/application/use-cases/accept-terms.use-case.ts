import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { User } from '../../domain/entities/user.entity';
import { USER_REPOSITORY, type UserRepository } from '../../domain/ports/user.repository.port';

@Injectable()
export class AcceptTermsUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: string, version: number): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new EntityNotFoundException('User', userId);
    user.acceptTerms(version);
    await this.users.save(user);
    return user;
  }
}
