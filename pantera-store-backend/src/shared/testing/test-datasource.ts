import { DataSource, type DataSourceOptions } from 'typeorm';

/**
 * Conexión para las pruebas contra Postgres real. Varias suites arrancan en
 * paralelo sobre la misma base y todas crean las tablas a la vez: eso choca
 * (pg_type duplicado), así que se reintenta con una pequeña espera al azar.
 */
export async function createTestDataSource(
  url: string,
  entities: DataSourceOptions['entities'],
): Promise<DataSource> {
  for (let attempt = 1; ; attempt += 1) {
    const dataSource = new DataSource({
      type: 'postgres',
      url,
      entities,
      synchronize: true,
    });
    try {
      await dataSource.initialize();
      return dataSource;
    } catch (error) {
      if (dataSource.isInitialized)
        await dataSource.destroy().catch(() => undefined);
      if (attempt >= 8) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 200 * attempt + Math.random() * 300),
      );
    }
  }
}
