# ClinicalContext — Claude Code Guide

## What this project is

A RAG (Retrieval-Augmented Generation) pipeline for BC Clinical Guidelines. Phase 1 ingests PDFs into PostgreSQL with pgvector embeddings. Phase 2 (not yet built) will be a query API that retrieves relevant chunks and passes them to Claude.

## Project status

- **Phase 1**: Complete — ingest pipeline builds and runs
- **Phase 2**: Not started — will be a query API

## Stack

- Node.js 18+ with ES modules (`"type": "module"`) — no TypeScript, no build step
- PostgreSQL 16 + pgvector via Docker
- Voyage AI `voyage-3` model for embeddings (1024 dimensions)
- `pdf-parse` for text extraction, `pg` for database, `pgvector` for the `toSql` helper only

## Running locally

```bash
cp .env.example .env        # add VOYAGE_API_KEY
npm install
docker compose up -d        # starts postgres on localhost:5432
node src/ingest.js ./guidelines
```

## Database

- Docker volume `pgdata` persists data across restarts
- `docker compose down` is safe; `docker compose down -v` wipes the DB
- Connect: `docker exec -it clinicalcontext-db-1 psql -U cc -d clinicalcontext`
- Schema lives in `migrations/001_init.sql` — auto-applied on first container start

## Voyage AI rate limits

- **Free tier without payment method**: 3 RPM → `RATE_LIMIT_MS=21000`
- **Free tier with payment method**: standard limits → `RATE_LIMIT_MS=500`
- 200M free tokens apply either way; full corpus (~192 PDFs) costs ~$0.12 in tokens

## Ingest behaviour

- Idempotent — re-running skips already-processed documents (checked by filename)
- Sequential only — no concurrent embed calls (preserves rate limiting)
- Failed PDFs are logged and skipped; they do not abort the run
- Per-chunk progress is printed to stdout during embedding

## Key constraints (do not change without good reason)

- ES modules throughout — no `require()`
- No LangChain or vector DB abstraction libraries — direct SQL and API calls only
- `pgvector` package used only for `toSql()` — all queries written by hand
- Native `fetch` only — no axios or node-fetch
- No concurrency over embed calls

## Lessons learned

> Keep this section updated as development progresses — add new entries whenever a bug is found, a design decision is made, or something surprising happens. This is the institutional memory for the project.



### Chunker bug (fixed 2026-03-31)
Original chunker searched for `\n\n` across the full chunk window. When a double newline appeared near the start of the window, `splitAt` barely advanced past `start`, causing `start` to increment by 1 char per iteration. Result: thousands of tiny slivers (e.g. 1211 chunks for an 8-page PDF, avg 258 chars each). Fix: only search for split points in the **latter half** of the window (`minSplit = start + chunkSize/2`), guaranteeing meaningful forward progress on every iteration.

**Lesson**: always sanity-check chunk counts and avg chunk size before running a long ingest. Healthy chunks should average 1000–2000 chars. A quick SQL query catches this early:
```sql
SELECT d.filename, COUNT(c.id) AS chunks, ROUND(AVG(length(c.content))) AS avg_chars
FROM documents d JOIN chunks c ON c.document_id = d.id
GROUP BY d.filename ORDER BY avg_chars ASC;
```

### Voyage AI free tier limits (2026-03-31)
Without a payment method: 3 RPM and 10K TPM. At 3 RPM with ~21s between requests, the full 192-PDF corpus (~3500 chunks total) takes 18–20 hours. With a payment method (still 200M free tokens, no charge for this corpus): standard rate limits, ingest completes in under an hour. Adding a payment method is the practical choice.

### Chunk size tuning
Current defaults: `chunkSize=2000, overlap=400`. For clinical guidelines, **1000–1500 chars** is likely a better target — guidelines are section-structured, and 2000 chars often spans two unrelated sections, degrading retrieval precision. Consider re-ingesting at 1200/300 once Phase 2 retrieval quality can be tested empirically.

### Checking DB health before a long ingest run
After any chunker or pipeline change, ingest 2–3 PDFs and inspect the DB before committing to the full corpus. Saves hours of wasted API calls.
