#!/usr/bin/env node
import {
  cleanupExpiredMemories,
  listMemories,
  listPending,
  markCore,
  searchMemories,
  setMemoryStatus,
  storeMemory,
} from './db.js';

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}

const cmd = process.argv[2];

if (cmd === 'store') {
  const content = arg('--content');
  if (!content) {
    console.error('Missing --content');
    process.exit(1);
  }
  const scope = arg('--scope', 'user');
  const kind = arg('--kind', 'note');
  const tags = (arg('--tags', '') || '').split(',').map(s => s.trim()).filter(Boolean);
  const ttlDays = arg('--ttl-days', null);
  const importance = Number(arg('--importance', 0));
  const autoConfirm = arg('--manual-confirm', 'false') !== 'true';

  const out = storeMemory({ scope, kind, content, tags, ttlDays, importance, autoConfirm });
  if (out.pending) console.log(`pending:${out.id}`);
  else if (out.deduped) console.log(`deduped:${out.id}`);
  else console.log(`stored:${out.id}`);
  process.exit(0);
}

if (cmd === 'search') {
  const raw = process.argv.slice(3);
  const qParts = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith('--')) { i += 1; continue; }
    qParts.push(raw[i]);
  }
  const query = qParts.join(' ').trim();
  if (!query) {
    console.error('Usage: mem search <query> [--limit 5]');
    process.exit(1);
  }
  const limit = Number(arg('--limit', 5));
  const rows = searchMemories(query, limit);
  for (const r of rows) {
    console.log(`#${r.id} [${r.scope}/${r.kind}] score=${Number(r.hybrid_score).toFixed(3)} core=${r.importance} ${r.content}`);
  }
  process.exit(0);
}

if (cmd === 'list') {
  const limit = Number(arg('--limit', 10));
  const rows = listMemories(limit);
  for (const r of rows) {
    const ttl = r.expires_at ? ` exp:${r.expires_at}` : '';
    console.log(`#${r.id} [${r.scope}/${r.kind}] status=${r.status} core=${r.importance} hits=${r.access_count}${ttl} ${r.content}`);
  }
  process.exit(0);
}

if (cmd === 'pending') {
  const rows = listPending(Number(arg('--limit', 20)));
  for (const r of rows) console.log(`#${r.id} [${r.kind}/${r.sensitivity}] ${r.content}`);
  process.exit(0);
}

if (cmd === 'approve') {
  const id = arg('--id');
  const out = setMemoryStatus(Number(id), 'active');
  console.log(`approved:${out.changed}`);
  process.exit(0);
}

if (cmd === 'reject') {
  const id = arg('--id');
  const out = setMemoryStatus(Number(id), 'rejected');
  console.log(`rejected:${out.changed}`);
  process.exit(0);
}

if (cmd === 'core') {
  const id = arg('--id');
  const importance = Number(arg('--importance', 10));
  const out = markCore(Number(id), importance);
  console.log(`core:${out.changed}`);
  process.exit(0);
}

if (cmd === 'cleanup') {
  const out = cleanupExpiredMemories();
  console.log(`deleted:${out.deleted}`);
  process.exit(0);
}

console.log(`ari-memory\n\nCommands:\n  store --content "..." [--scope user] [--kind note] [--tags a,b] [--ttl-days N] [--importance N] [--manual-confirm true]\n  search <query> [--limit 5]\n  list [--limit 10]\n  pending [--limit 20]\n  approve --id N\n  reject --id N\n  core --id N [--importance 10]\n  cleanup`);
