export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

/**
 * Handle opaco de una transacción de base de datos en curso. La aplicación no
 * sabe qué hay adentro (en la práctica, el EntityManager de TypeORM): solo lo
 * pasa de un repositorio a otro para que todos escriban en LA MISMA transacción.
 */
export type TransactionContext = { readonly __transaction: unique symbol };

export interface UnitOfWork {
  /** Corre `work` dentro de una transacción: si lanza, TODO lo escrito se deshace. */
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
