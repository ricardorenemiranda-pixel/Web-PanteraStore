import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { User } from '../../domain/entities/user.entity';
import { USER_REPOSITORY, type UserRepository } from '../../domain/ports/user.repository.port';

const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos.';

@Injectable()
export class LoginWithPasswordUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new InvalidDomainStateException(INVALID_CREDENTIALS_MESSAGE);
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new InvalidDomainStateException(INVALID_CREDENTIALS_MESSAGE);
    }

    return user;
  }
}
