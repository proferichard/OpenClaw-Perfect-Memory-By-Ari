import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DB_PATH = process.env.ARI_MEMORY_DB || '/home/ubuntu/.openclaw/workspace/memory/ari-memory.db';

function nowIso() { return new Date().toISOString(); }

function hashContent(scope, kind, content) {
  return crypto.createHash('sha256').update(`${scope}|${kind}|${content.trim().toLowerCase()}`).digest('hex');
}

function ttlToExpiresAt(ttlDays) {
  const d = Number(ttlDays);
  if (!Number.isFinite(d) || d <= 0) return null;
  const ms = d * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

function sensitivityOf(kind) {
  if (['identity', 'security', 'finance', 'family', 'health'].includes(kind)) return 'sensitive';
  if (['decision', 'preference', 'rule'].includes(kind)) return 'important';
  return 'normal';
}

export function openDb(dbPath = DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL;');
  db.exec('PRAGMA synchronous=NORMAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      scope TEXT NOT NULL,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      content_hash TEXT,
      expires_at TEXT,
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed_at TEXT,
      importance INTEGER NOT NULL DEFAULT 0,
      sensitivity TEXT NOT NULL DEFAULT 'normal',
      requires_confirmation INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content, tags, content='memories', content_rowid='id');

    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, tags) VALUES (new.id, new.content, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags) VALUES('delete', old.id, old.content, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags) VALUES('delete', old.id, old.content, old.tags);
      INSERT INTO memories_fts(rowid, content, tags) VALUES (new.id, new.content, new.tags);
    END;
  `);

  const cols = db.prepare(`PRAGMA table_info(memories)`).all();
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('updated_at')) db.exec(`ALTER TABLE memories ADD COLUMN updated_at TEXT`);
  if (!names.has('content_hash')) db.exec(`ALTER TABLE memories ADD COLUMN content_hash TEXT`);
  if (!names.has('expires_at')) db.exec(`ALTER TABLE memories ADD COLUMN expires_at TEXT`);
  if (!names.has('access_count')) db.exec(`ALTER TABLE memories ADD COLUMN access_count INTEGER NOT NULL DEFAULT 0`);
  if (!names.has('last_accessed_at')) db.exec(`ALTER TABLE memories ADD COLUMN last_accessed_at TEXT`);
  if (!names.has('importance')) db.exec(`ALTER TABLE memories ADD COLUMN importance INTEGER NOT NULL DEFAULT 0`);
  if (!names.has('sensitivity')) db.exec(`ALTER TABLE memories ADD COLUMN sensitivity TEXT NOT NULL DEFAULT 'normal'`);
  if (!names.has('requires_confirmation')) db.exec(`ALTER TABLE memories ADD COLUMN requires_confirmation INTEGER NOT NULL DEFAULT 0`);
  if (!names.has('status')) db.exec(`ALTER TABLE memories ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);

  db.exec(`UPDATE memories SET updated_at = COALESCE(updated_at, created_at, '${nowIso()}')`);
  db.exec(`DROP INDEX IF EXISTS idx_memories_content_hash`);

  const missingHashRows = db.prepare(`SELECT id, scope, kind, content FROM memories WHERE content_hash IS NULL OR content_hash = ''`).all();
  const hashStmt = db.prepare(`UPDATE memories SET content_hash = ? WHERE id = ?`);
  for (const r of missingHashRows) hashStmt.run(hashContent(r.scope, r.kind, r.content), r.id);

  db.exec(`DELETE FROM memories WHERE id NOT IN (SELECT MAX(id) FROM memories GROUP BY content_hash)`);

  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_content_hash ON memories(content_hash)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status)`);

  return db;
}

export function storeMemory({ scope = 'user', kind = 'note', content, tags = [], ttlDays = null, importance = 0, sensitive = null, autoConfirm = true }) {
  const db = openDb();
  const tagStr = Array.isArray(tags) ? tags.join(',') : String(tags || '');
  const cleanContent = String(content || '').trim();
  if (!cleanContent) throw new Error('content is required');

  const h = hashContent(scope, kind, cleanContent);
  const existing = db.prepare(`SELECT id FROM memories WHERE content_hash = ?`).get(h);
  if (existing?.id) {
    db.prepare(`UPDATE memories SET updated_at = ?, tags = CASE WHEN tags = '' THEN ? ELSE tags END WHERE id = ?`).run(nowIso(), tagStr, existing.id);
    return { id: Number(existing.id), deduped: true };
  }

  const sens = sensitive || sensitivityOf(kind);
  const needsConfirm = autoConfirm ? 0 : (sens === 'sensitive' ? 1 : 0);
  const status = needsConfirm ? 'pending' : 'active';

  const stmt = db.prepare(`
    INSERT INTO memories (created_at, updated_at, scope, kind, content, tags, content_hash, expires_at, importance, sensitivity, requires_confirmation, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(nowIso(), nowIso(), scope, kind, cleanContent, tagStr, h, ttlToExpiresAt(ttlDays), Number(importance || 0), sens, needsConfirm, status);
  return { id: Number(res.lastInsertRowid), deduped: false, pending: status === 'pending' };
}

export function setMemoryStatus(id, status) {
  const db = openDb();
  const res = db.prepare(`UPDATE memories SET status = ?, updated_at = ? WHERE id = ?`).run(status, nowIso(), Number(id));
  return { changed: Number(res.changes || 0) };
}

export function markCore(id, importance = 10) {
  const db = openDb();
  const res = db.prepare(`UPDATE memories SET importance = ?, updated_at = ? WHERE id = ?`).run(Number(importance), nowIso(), Number(id));
  return { changed: Number(res.changes || 0) };
}

export function listPending(limit = 20) {
  const db = openDb();
  return db.prepare(`SELECT id, created_at, kind, sensitivity, content FROM memories WHERE status = 'pending' ORDER BY id DESC LIMIT ?`).all(limit);
}

export function cleanupExpiredMemories() {
  const db = openDb();
  const res = db.prepare(`DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at <= ?`).run(nowIso());
  return { deleted: Number(res.changes || 0) };
}

export function searchMemories(query, limit = 5) {
  const db = openDb();
  const stmt = db.prepare(`
    SELECT
      m.id, m.created_at, m.updated_at, m.scope, m.kind, m.content, m.tags,
      m.expires_at, m.access_count, m.importance, m.status,
      bm25(memories_fts) AS fts_score,
      (bm25(memories_fts) * -1.0)
      + CASE
          WHEN (julianday('now') - julianday(m.updated_at)) <= 1 THEN 1.0
          WHEN (julianday('now') - julianday(m.updated_at)) <= 7 THEN 0.5
          WHEN (julianday('now') - julianday(m.updated_at)) <= 30 THEN 0.2
          ELSE 0.0
        END
      + (m.importance * 0.15) AS hybrid_score
    FROM memories_fts f
    JOIN memories m ON m.id = f.rowid
    WHERE memories_fts MATCH ?
      AND m.status = 'active'
      AND (m.expires_at IS NULL OR m.expires_at > datetime('now'))
    ORDER BY hybrid_score DESC
    LIMIT ?
  `);
  const rows = stmt.all(query, limit);
  const touch = db.prepare(`UPDATE memories SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?`);
  for (const r of rows) touch.run(nowIso(), r.id);
  return rows;
}

export function listMemories(limit = 10) {
  const db = openDb();
  return db.prepare(`
    SELECT id, created_at, updated_at, scope, kind, content, tags, expires_at, access_count, importance, sensitivity, status
    FROM memories
    WHERE expires_at IS NULL OR expires_at > datetime('now')
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
}
