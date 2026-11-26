import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from './config.js'

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true })

export const db = new DatabaseSync(config.databasePath)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

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
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memberships (
    user_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'shop', 'tech')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id);

  CREATE TABLE IF NOT EXISTS vans (
    id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    tech_name TEXT NOT NULL DEFAULT '',
    number TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (org_id, id),
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
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
    org_id TEXT NOT NULL,
    van_id TEXT NOT NULL,
    van_name TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    job_tag TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('pending', 'picked', 'restocked')),
    restocked_at TEXT,
    items_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (org_id, id),
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_orders_org_submitted ON orders(org_id, submitted_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(org_id, status);

  CREATE TABLE IF NOT EXISTS sync_operations (
    org_id TEXT NOT NULL,
    op_id TEXT NOT NULL,
    device_id TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    PRIMARY KEY (org_id, op_id)
  );
`)

try {
  db.exec('ALTER TABLE organizations ADD COLUMN license_key TEXT')
} catch {
  // Column already exists.
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // Preserve the original failure.
    }
    throw error
  }
}

export function bumpRevision(orgId: string): void {
  db.prepare(
    'UPDATE organizations SET revision = revision + 1 WHERE id = ?',
  ).run(orgId)
}
