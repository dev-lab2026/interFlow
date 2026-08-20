import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST || 'interflow-postgres',
      user: process.env.SQL_USER || 'interflow',
      password: process.env.SQL_PASSWORD || '',
      database: process.env.SQL_DB_NAME || 'interflow',
      port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT) : 5432,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
