import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Blindaje a nivel de base de datos: aunque alguien con acceso al servidor (o
 * un bug) intente editar o borrar un movimiento, Postgres lo rechaza.
 *
 * Es idempotente y NUNCA deja la tabla sin protección: el candado se crea solo
 * si no existe (no se borra y se vuelve a crear), y todo corre dentro de una
 * transacción con un candado de aviso, para que dos instancias arrancando a la
 * vez no se pisen.
 */
@Injectable()
export class LedgerImmutabilityGuard implements OnModuleInit {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtext('wallet_ledger_entries_immutability'))`,
      );
      await manager.query(`
        CREATE OR REPLACE FUNCTION wallet_ledger_entries_immutable() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'wallet_ledger_entries es de solo escritura: no se permite % sobre un movimiento', TG_OP;
        END;
        $$ LANGUAGE plpgsql;
      `);
      await manager.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'wallet_ledger_entries_no_update_delete'
              AND tgrelid = 'wallet_ledger_entries'::regclass
          ) THEN
            CREATE TRIGGER wallet_ledger_entries_no_update_delete
            BEFORE UPDATE OR DELETE ON wallet_ledger_entries
            FOR EACH ROW EXECUTE FUNCTION wallet_ledger_entries_immutable();
          END IF;
        END
        $$;
      `);
    });
  }
}
