import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  DomainException,
  EntityNotFoundException,
  ExternalServiceUnavailableException,
  ForbiddenActionException,
  InvalidDomainStateException,
} from '../../domain/exceptions/domain.exception';

/**
 * Traduce excepciones de dominio (que no saben nada de HTTP) al código de
 * estado correcto. Así los casos de uso y entidades solo lanzan errores de
 * negocio (EntityNotFoundException, InvalidDomainStateException, etc.) y
 * esta capa de interfaz decide cómo se ve eso "hacia afuera".
 */
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = this.resolveStatus(exception);

    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
    });
  }

  private resolveStatus(exception: DomainException): number {
    if (exception instanceof EntityNotFoundException) {
      return HttpStatus.NOT_FOUND;
    }
    if (exception instanceof InvalidDomainStateException) {
      return HttpStatus.BAD_REQUEST;
    }
    if (exception instanceof ForbiddenActionException) {
      return HttpStatus.FORBIDDEN;
    }
    if (exception instanceof ExternalServiceUnavailableException) {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }
    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
}
