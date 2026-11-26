import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface StoredUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER';
  passwordHash: string;
  isActive: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface StoredSession {
  token: string;
  userId: string;
  expiresAt: number;
}

function resolveDataDir(): string {
  const candidates = [
    process.env.DATA_DIR,
    path.resolve(process.cwd(), 'data'),
    path.join('/tmp', 'recouvrix-data'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // try next
    }
  }
  // Last resort: in-memory path under /tmp
  const fallback = path.join('/tmp', `recouvrix-${process.pid}`);
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

const dataDir = resolveDataDir();
const dbPath = path.join(dataDir, 'recouvrix-demo.sqlite');

let sql: DatabaseSync;
try {
  sql = new DatabaseSync(dbPath);
  console.log(`SQLite démo ouvert : ${dbPath}`);
} catch (err) {
  console.error('Échec ouverture SQLite fichier, repli :memory:', err);
  sql = new DatabaseSync(':memory:');
}

sql.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MANAGER')),
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

function mapUser(row: Record<string, unknown>): StoredUser {
  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    role: row.role === 'ADMIN' ? 'ADMIN' : 'MANAGER',
    passwordHash: String(row.password_hash),
    isActive: Number(row.is_active) === 1,
    isDemo: Number(row.is_demo) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  };
}

export function listUsers(): StoredUser[] {
  const rows = sql.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as Record<
    string,
    unknown
  >[];
  return rows.map(mapUser);
}

export function findUserByEmail(email: string): StoredUser | null {
  const row = sql
    .prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
    .get(email.trim()) as Record<string, unknown> | undefined;
  return row ? mapUser(row) : null;
}

export function findUserById(id: string): StoredUser | null {
  const row = sql.prepare('SELECT * FROM users WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapUser(row) : null;
}

export function upsertUser(user: StoredUser): void {
  sql
    .prepare(
      `INSERT INTO users (
        id, email, full_name, role, password_hash, is_active, is_demo, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        password_hash = excluded.password_hash,
        is_active = excluded.is_active,
        is_demo = excluded.is_demo,
        updated_at = excluded.updated_at,
        last_login_at = excluded.last_login_at`
    )
    .run(
      user.id,
      user.email.trim().toLowerCase(),
      user.fullName,
      user.role,
      user.passwordHash,
      user.isActive ? 1 : 0,
      user.isDemo ? 1 : 0,
      user.createdAt,
      user.updatedAt,
      user.lastLoginAt
    );
}

export function countUsers(): number {
  const row = sql.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
  return Number(row.c) || 0;
}

export function createSession(token: string, userId: string, expiresAt: number): void {
  sql
    .prepare(
      'INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
    )
    .run(token, userId, expiresAt);
}

export function getSession(token: string): StoredSession | null {
  const row = sql.prepare('SELECT * FROM sessions WHERE token = ?').get(token) as
    | { token: string; user_id: string; expires_at: number }
    | undefined;
  if (!row) return null;
  return { token: row.token, userId: row.user_id, expiresAt: Number(row.expires_at) };
}

export function deleteSession(token: string): void {
  sql.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function purgeExpiredSessions(now = Date.now()): void {
  sql.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
}

export function getDemoDbPath(): string {
  return dbPath;
}
