import { Pool, type QueryResult, type QueryResultRow } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _interflowPgPool: Pool | undefined;
}

export function createPool(): Pool {
  if (!global._interflowPgPool) {
    global._interflowPgPool = new Pool({
      host: process.env.SQL_HOST || 'interflow-postgres',
      port: Number(process.env.SQL_PORT || 5432),
      database: process.env.SQL_DB_NAME || 'interflow',
      user: process.env.SQL_USER || 'interflow',
      password: process.env.SQL_PASSWORD || '',
      max: 10,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
    });
    global._interflowPgPool.on('error', (error) => {
      console.error('PostgreSQL pool error:', error);
    });
  }
  return global._interflowPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return createPool().query<T>(text, values);
}

export async function withTransaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await createPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
