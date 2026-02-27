#!/usr/bin/env node
import { listPending, searchMemories, storeMemory } from './db.js';

const mode = process.argv[2];

if (mode === 'recall') {
  const query = process.argv.slice(3).join(' ').trim();
  if (!query) {
    console.error('usage: bridge recall <query>');
    process.exit(1);
  }
  const rows = searchMemories(query, 5);
  const packed = rows.map((r, i) => `${i + 1}. [${r.scope}/${r.kind}] ${r.content}`).join('\n');
  console.log(packed || '(sin recuerdos relevantes)');
  process.exit(0);
}

if (mode === 'context') {
  const query = process.argv.slice(3).join(' ').trim();
  if (!query) {
    console.error('usage: bridge context <query>');
    process.exit(1);
  }
  const rows = searchMemories(query, 8);
  const header = 'MEMORIA RELEVANTE (usar solo si aplica):';
  const packed = rows.map((r, i) => `- (${i + 1}) [${r.scope}/${r.kind}] core=${r.importance} ${r.content}`).join('\n');
  console.log(`${header}\n${packed || '- (sin recuerdos relevantes)'}`);
  process.exit(0);
}

if (mode === 'remember') {
  const content = process.argv.slice(3).join(' ').trim();
  if (!content) {
    console.error('usage: bridge remember <content>');
    process.exit(1);
  }
  const out = storeMemory({ scope: 'user', kind: 'note', content, tags: ['auto'], importance: 1 });
  console.log(out.pending ? `pending:${out.id}` : (out.deduped ? `deduped:${out.id}` : `stored:${out.id}`));
  process.exit(0);
}

if (mode === 'remember-sensitive') {
  const content = process.argv.slice(3).join(' ').trim();
  if (!content) {
    console.error('usage: bridge remember-sensitive <content>');
    process.exit(1);
  }
  const out = storeMemory({ scope: 'user', kind: 'security', content, tags: ['sensitive'], importance: 8, autoConfirm: false });
  console.log(out.pending ? `pending:${out.id}` : `stored:${out.id}`);
  process.exit(0);
}

if (mode === 'pending') {
  const rows = listPending(20);
  rows.forEach(r => console.log(`#${r.id} [${r.kind}/${r.sensitivity}] ${r.content}`));
  process.exit(0);
}

console.log('usage: bridge <recall|context|remember|remember-sensitive|pending> ...');