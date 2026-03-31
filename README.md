# ClinicalContext

ClinicalContext is a RAG (Retrieval-Augmented Generation) system built on BC Clinical Guidelines. It ingests PDF guidelines, embeds their content using Voyage AI, and stores the vectors in PostgreSQL — enabling a query API (Phase 2) to retrieve clinically relevant context for any medical question.

## Architecture

```
PDF files → extract text → chunk → embed (Voyage AI) → pgvector (PostgreSQL)
                                                              ↓
                                          query API (Phase 2) ← user question
```

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Voyage AI API key (free tier at voyageai.com — 200M tokens free)

## Setup

```bash
git clone ...
cd clinicalcontext
cp .env.example .env
# Add your VOYAGE_API_KEY to .env
npm install
docker compose up -d
# Wait ~5 seconds for postgres to initialise
node src/ingest.js ./guidelines
```

## Verifying Phase 1

After ingest completes, connect to the database and run:

```sql
SELECT d.filename, COUNT(c.id) AS chunks
FROM documents d
JOIN chunks c ON c.document_id = d.id
GROUP BY d.filename
ORDER BY chunks DESC
LIMIT 20;
```

You should see one row per guideline PDF with a chunk count in the range of 10–80 depending on document length.

## Corpus note

Guidelines corpus sourced from the BC Guidelines & Protocols Advisory Committee (bcguidelines.ca). PDFs are not included in this repository. Download the full corpus zip from bcguidelines.ca and extract into a `./guidelines` directory before running ingest.
