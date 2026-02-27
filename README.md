# OpenClaw-Perfect-Memory-By-Ari 🧠✨

A practical **hybrid memory stack** for OpenClaw-style agents:

- Local-first persistence (SQLite + FTS5)
- Fast recall via lexical + hybrid scoring
- Deduplication + TTL retention
- Sensitive memory governance (pending/approve/reject)
- Daily consolidation + contradiction checks
- Operational scripts for start/stop/status/cleanup

> Built in the wild while iterating Ari's real assistant memory system.

---

## Why this project?

Most agent memory demos are either too academic or too complex to operate.
This project prioritizes:

1. **Simplicity first** (works with Node + SQLite)
2. **Useful memory quality** (not just storage)
3. **Operational safety** (backups, pending approvals, retention)

---

## Architecture

### L1 (active now)
- SQLite as source of truth
- FTS5 for full-text recall
- Hybrid ranking (text relevance + recency + importance)

### L2 (optional)
- Semantic vector retrieval (future module)

### L3 (optional)
- Graph/relationship layer (future module)

---

## Features

- ✅ `store/search/list/cleanup`
- ✅ `core` memories (importance boost)
- ✅ `pending` workflow for sensitive memories
- ✅ Ingest + daily summary + contradictions scripts
- ✅ Local HTTP API (`/health`, `/memories`, `/search`, `/cleanup`)

---

## Quick start

```bash
npm install
node src/cli.js store --content "User prefers concise updates" --kind preference --importance 8
node src/cli.js search prefers
node src/server.js
```

### Service scripts

```bash
./scripts/ari_memory_start.sh
./scripts/ari_memory_status.sh
./scripts/ari_memory_stop.sh
```

---

## CLI examples

```bash
node src/cli.js store --content "Critical rule" --kind rule --importance 10
node src/cli.js core --id 12 --importance 12
node src/cli.js pending
node src/cli.js approve --id 44
node src/cli.js reject --id 45
```

### Sensitive memory (requires human confirmation)

```bash
node src/bridge.js remember-sensitive "Temporary credential rotation note"
node src/cli.js pending
```

---

## Automation scripts

- `scripts/ari_memory_ingest.sh`
- `scripts/ari_memory_consolidate.sh`
- `scripts/ari_memory_contradictions.sh`
- `scripts/ari_memory_pending_report.sh`

---

## Safety notes

- Do **not** commit real secrets or private personal memory files.
- Keep production DB and user data out of git.

---

## Roadmap

- [ ] Confidence scoring for contradiction alerts
- [ ] Semantic retrieval plugin (drop-in)
- [ ] Graph memory module
- [ ] Benchmarks + evaluation harness

---

## License

MIT
