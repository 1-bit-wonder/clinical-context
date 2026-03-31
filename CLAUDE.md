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
