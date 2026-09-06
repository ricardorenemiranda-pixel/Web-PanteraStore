/**
 * Base de todos los errores de dominio. Nunca depende de HTTP ni de NestJS:
 * el dominio no sabe que existe una API REST por encima suyo.
 * El filtro global (interface/filters) traduce estos errores a códigos HTTP.
 */
export abstract class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, id: string) {
    super(`${entityName} con id "${id}" no fue encontrado.`);
  }
}

export class InvalidDomainStateException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

/** Una dependencia externa (ej. Steam) no respondió bien tras reintentar — no es culpa del usuario. */
export class ExternalServiceUnavailableException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
