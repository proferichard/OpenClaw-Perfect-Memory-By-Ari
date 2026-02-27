#!/usr/bin/env node
import http from 'node:http';
import { cleanupExpiredMemories, listMemories, searchMemories, storeMemory } from './db.js';

const PORT = Number(process.env.ARI_MEMORY_PORT || 7787);

function send(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1_000_000) req.destroy(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, service: 'ari-memory', port: PORT });
    }

    if (req.method === 'GET' && url.pathname === '/memories') {
      const limit = Number(url.searchParams.get('limit') || 20);
      return send(res, 200, { items: listMemories(limit) });
    }

    if (req.method === 'POST' && url.pathname === '/memories') {
      const body = await readJson(req);
      const out = storeMemory(body);
      return send(res, 200, { ok: true, ...out });
    }

    if (req.method === 'POST' && url.pathname === '/search') {
      const body = await readJson(req);
      const q = String(body.query || '').trim();
      if (!q) return send(res, 400, { ok: false, error: 'query is required' });
      const limit = Number(body.limit || 5);
      return send(res, 200, { items: searchMemories(q, limit) });
    }

    if (req.method === 'POST' && url.pathname === '/cleanup') {
      return send(res, 200, { ok: true, ...cleanupExpiredMemories() });
    }

    return send(res, 404, { ok: false, error: 'not_found' });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e?.message || e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ari-memory api listening on http://127.0.0.1:${PORT}`);
});
