import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { User } from '../../domain/entities/user.entity';
import { USER_REPOSITORY, type UserRepository } from '../../domain/ports/user.repository.port';

const BCRYPT_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

export interface RegisterUserInput {
  displayName: string;
  email: string;
  password: string;
  tradeUrl: string;
}

/**
 * Crea una cuenta local (usuario/contraseña) sin Steam todavía — Steam se
 * vincula después desde el perfil (ver steamReturn() en auth.controller.ts).
 * El trade URL es obligatorio desde el registro porque sin él la empresa no
 * podría pagarle al usuario cuando venda un item.
 */
@Injectable()
export class RegisterUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(input: RegisterUserInput): Promise<User> {
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new InvalidDomainStateException(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
    }

    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new InvalidDomainStateException('Ya existe una cuenta registrada con ese correo.');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    const user = User.create({
      id: randomUUID(),
      displayName: input.displayName,
      email: input.email,
      passwordHash,
      tradeUrl: input.tradeUrl,
      role: 'customer',
    });

    await this.users.save(user);
    return user;
  }
}
