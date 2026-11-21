import { neonConfig, Pool } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

type Queryable = {
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: unknown[]; rowCount: number | null }>
}

export interface DbTransaction extends Queryable {
  one<T>(text: string, values?: unknown[]): Promise<T | undefined>
  many<T>(text: string, values?: unknown[]): Promise<T[]>
  execute(text: string, values?: unknown[]): Promise<number>
}

const globalForDb = globalThis as typeof globalThis & {
  __trucktapPool?: Pool
  __trucktapSchemaPromise?: Promise<void>
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.')
  }

  if (!globalForDb.__trucktapPool) {
    globalForDb.__trucktapPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 15_000,
      connectionTimeoutMillis: 10_000,
      application_name: 'trucktap-web',
    })
  }

  return globalForDb.__trucktapPool
}

async function query<T>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, values)
  return result.rows as T[]
}

async function execute(text: string, values: unknown[] = []): Promise<number> {
  const result = await getPool().query(text, values)
  return result.rowCount ?? 0
}

async function one<T>(
  text: string,
  values: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(text, values)
  return rows[0]
}

async function initializeSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      join_code TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'team',
      revision INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memberships (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'shop', 'tech')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id);

    CREATE TABLE IF NOT EXISTS vans (
      id TEXT NOT NULL,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      tech_name TEXT NOT NULL DEFAULT '',
      number TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (org_id, id)
    );

    CREATE TABLE IF NOT EXISTS parts (
      id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      van_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      par_level INTEGER NOT NULL DEFAULT 0,
      current_used_today INTEGER NOT NULL DEFAULT 0,
      icon_name TEXT NOT NULL DEFAULT 'Package',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (org_id, id),
      FOREIGN KEY (org_id, van_id) REFERENCES vans(org_id, id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_parts_van ON parts(org_id, van_id);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT NOT NULL,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      van_id TEXT NOT NULL,
      van_name TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      job_tag TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('pending', 'picked', 'restocked')),
      restocked_at TEXT,
      items_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (org_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_orders_org_submitted ON orders(org_id, submitted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(org_id, status);

    CREATE TABLE IF NOT EXISTS sync_operations (
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      op_id TEXT NOT NULL,
      device_id TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      PRIMARY KEY (org_id, op_id)
    );
  `)
}

export function ensureSchema(): Promise<void> {
  if (!globalForDb.__trucktapSchemaPromise) {
    globalForDb.__trucktapSchemaPromise = initializeSchema().catch(
      (error: unknown) => {
        globalForDb.__trucktapSchemaPromise = undefined
        throw error
      },
    )
  }
  return globalForDb.__trucktapSchemaPromise
}

export const db = {
  query,
  one,
  execute,
  ensureSchema,
}

export async function transaction<T>(
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect()
  const tx: DbTransaction = {
    query: async (text, values = []) => {
      const result = await client.query(text, values)
      return { rows: result.rows as unknown[], rowCount: result.rowCount }
    },
    one: async <U>(text: string, values: unknown[] = []) => {
      const result = await client.query(text, values)
      return (result.rows[0] as U | undefined) ?? undefined
    },
    many: async <U>(text: string, values: unknown[] = []) => {
      const result = await client.query(text, values)
      return result.rows as U[]
    },
    execute: async (text, values = []) => {
      const result = await client.query(text, values)
      return result.rowCount ?? 0
    },
  }

  try {
    await client.query('BEGIN')
    const result = await fn(tx)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Keep the original error.
    }
    throw error
  } finally {
    client.release()
  }
}
