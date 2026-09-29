import { Pool } from 'pg';
import type { DatabaseData } from './db.ts';

const connectionString = String(process.env.DATABASE_URL || '').trim();
const enabled = Boolean(connectionString);

let pool: Pool | null = null;
let initialized = false;
let initPromise: Promise<boolean> | null = null;

function getPool(): Pool | null {
  if (!enabled) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

async function initialize(): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hotel_malabar_data (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    initialized = true;
    return true;
  } catch (error) {
    console.error('AIC PostgreSQL initialization failed:', error);
    return false;
  }
}

async function ensureInitialized(): Promise<boolean> {
  if (initialized) return true;
  if (!initPromise) initPromise = initialize().finally(() => { initPromise = null; });
  return initPromise;
}

function usable(data: any): data is DatabaseData {
  return !!data && typeof data === 'object' && !Array.isArray(data) &&
    Array.isArray(data.users) && Array.isArray(data.orders) &&
    Array.isArray(data.menuItems) && data.deliverySettings;
}

export async function syncFromPostgres(): Promise<DatabaseData | null> {
  if (!enabled || !(await ensureInitialized())) return null;
  const db = getPool();
  if (!db) return null;
  try {
    const result = await db.query('SELECT data FROM hotel_malabar_data WHERE id = 1 LIMIT 1');
    const remote = result.rows[0]?.data;
    return usable(remote) ? remote : null;
  } catch (error) {
    console.error('AIC PostgreSQL read failed:', error);
    return null;
  }
}

export async function syncToPostgres(data: DatabaseData): Promise<boolean> {
  if (!enabled || !usable(data) || !(await ensureInitialized())) return false;
  const db = getPool();
  if (!db) return false;
  try {
    await db.query(
      `INSERT INTO hotel_malabar_data (id, data, updated_at)
       VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE
       SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify(data)]
    );
    return true;
  } catch (error) {
    console.error('AIC PostgreSQL write failed:', error);
    return false;
  }
}

export function hasPostgresConfig(): boolean {
  return enabled;
}

export async function closePostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  initialized = false;
}
