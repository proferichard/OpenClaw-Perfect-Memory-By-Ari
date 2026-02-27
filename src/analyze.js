#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.ARI_MEMORY_DB || '/home/ubuntu/.openclaw/workspace/memory/ari-memory.db';
const db = new DatabaseSync(dbPath);

function dailySummary() {
  const rows = db.prepare(`
    SELECT id, created_at, kind, content
    FROM memories
    WHERE datetime(created_at) >= datetime('now', '-1 day')
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY id DESC
  `).all();

  const counts = new Map();
  for (const r of rows) counts.set(r.kind, (counts.get(r.kind) || 0) + 1);

  const lines = [];
  lines.push(`# Resumen Ari Memory (24h)`);
  lines.push(`- total: ${rows.length}`);
  lines.push(`- por tipo: ${[...counts.entries()].map(([k,v]) => `${k}:${v}`).join(', ') || 'n/a'}`);
  lines.push('');
  lines.push('## Highlights');
  for (const r of rows.slice(0, 12)) {
    lines.push(`- [${r.kind}] ${String(r.content).slice(0, 180)}`);
  }
  console.log(lines.join('\n'));
}

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldIgnoreKey(key) {
  const stop = new Set(['nombre', 'familia', 'proyectos importantes', 'recordatorios', 'sobre mi', 'sobre profe richard']);
  return stop.has(key);
}

function looksEquivalent(a, b) {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const wa = new Set(a.split(' '));
  const wb = new Set(b.split(' '));
  const inter = [...wa].filter(x => wb.has(x)).length;
  const union = new Set([...wa, ...wb]).size || 1;
  const jaccard = inter / union;
  return jaccard >= 0.72;
}

function contradictions() {
  const rows = db.prepare(`
    SELECT id, created_at, content, kind
    FROM memories
    WHERE kind IN ('preference','note','decision','rule')
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY id DESC
    LIMIT 800
  `).all();

  const bucket = new Map();
  for (const r of rows) {
    const s = String(r.content || '');
    const m = s.match(/^\*\*(.+?)\*\*:\s*(.+)$/) || s.match(/^([^:]{3,60}):\s*(.+)$/);
    if (!m) continue;

    const rawKey = normText(m[1]);
    const rawVal = normText(m[2]);
    if (!rawKey || !rawVal || shouldIgnoreKey(rawKey)) continue;

    if (!bucket.has(rawKey)) bucket.set(rawKey, []);

    const arr = bucket.get(rawKey);
    let merged = false;
    for (const item of arr) {
      if (looksEquivalent(item.value, rawVal)) {
        item.count += 1;
        item.samples.push(s);
        merged = true;
        break;
      }
    }
    if (!merged) arr.push({ value: rawVal, count: 1, samples: [s], kind: r.kind });
  }

  const findings = [];
  for (const [k, vals] of bucket.entries()) {
    if (vals.length >= 2) {
      const sorted = vals.sort((a, b) => b.count - a.count);
      // require reasonably distinct top two variants
      if (!looksEquivalent(sorted[0].value, sorted[1].value)) {
        findings.push({ key: k, values: sorted });
      }
    }
  }

  if (!findings.length) {
    console.log('SIN_CONTRADICCIONES');
    return;
  }

  console.log('# Posibles contradicciones (filtradas)');
  for (const f of findings.slice(0, 20)) {
    const parts = f.values.slice(0, 3).map(v => `"${v.value}"(${v.count})`);
    console.log(`- ${f.key}: ${parts.join(' vs ')}`);
  }
}
const cmd = process.argv[2];
if (cmd === 'daily-summary') dailySummary();
else if (cmd === 'contradictions') contradictions();
else console.log('usage: analyze <daily-summary|contradictions>');