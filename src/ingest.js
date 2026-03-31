import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { extractText } from './extract.js';
import { chunkText } from './chunker.js';
import { embed } from './embedder.js';
import { createPool, documentExists, insertDocument, insertChunk } from './store.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function toTitleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function deriveTitle(filename) {
  return toTitleCase(
    path.basename(filename, '.pdf').replace(/[-_]/g, ' ')
  );
}

// Validate required env vars
const DATABASE_URL = process.env.DATABASE_URL;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS ?? '21000', 10);

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required.');
  process.exit(1);
}
if (!VOYAGE_API_KEY) {
  console.error('Error: VOYAGE_API_KEY environment variable is required.');
  process.exit(1);
}

// Parse CLI argument
const guidelinesDir = process.argv[2];
if (!guidelinesDir) {
  console.error('Usage: node src/ingest.js <guidelines-directory>');
  process.exit(1);
}

if (!fs.existsSync(guidelinesDir) || !fs.statSync(guidelinesDir).isDirectory()) {
  console.error(`Error: "${guidelinesDir}" is not a valid directory.`);
  process.exit(1);
}

async function main() {
  const pool = await createPool(DATABASE_URL).catch(err => {
    console.error(`Error: Could not connect to database — ${err.message}`);
    process.exit(1);
  });

  const entries = fs.readdirSync(guidelinesDir, { recursive: true, withFileTypes: true });
  const pdfFiles = entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.pdf'))
    .map(e => path.join(e.path ?? e.parentPath ?? guidelinesDir, e.name));

  console.log(`Found ${pdfFiles.length} PDF file(s) in "${guidelinesDir}"\n`);

  let docsProcessed = 0;
  let totalChunks = 0;

  for (const filePath of pdfFiles) {
    const filename = path.basename(filePath);

    // Skip already-ingested documents
    if (await documentExists(pool, filename)) {
      console.log(`→ skip: ${filename} (already ingested)`);
      continue;
    }

    // Extract text
    let text;
    try {
      text = await extractText(filePath);
    } catch (err) {
      console.error(`✗ ${filename} — extraction failed: ${err.message}`);
      continue;
    }

    // Insert document record
    const title = deriveTitle(filename);
    const documentId = await insertDocument(pool, filename, title);

    // Chunk the text
    const chunks = chunkText(text);
    console.log(`  ${filename} — ${chunks.length} chunks to embed (${Math.ceil(chunks.length * RATE_LIMIT_MS / 60000)}m estimated)`);

    let chunksIngested = 0;
    for (const chunk of chunks) {
      process.stdout.write(`  chunk ${chunk.chunkIndex + 1}/${chunks.length} ...`);

      // Embed with one retry on failure
      let embedding;
      try {
        embedding = await embed(chunk.content, VOYAGE_API_KEY);
      } catch (err) {
        process.stdout.write(` ⚠ 429, retrying in 2s\n`);
        await sleep(2000);
        try {
          embedding = await embed(chunk.content, VOYAGE_API_KEY);
        } catch (retryErr) {
          console.warn(`  ✗ embed retry failed for chunk ${chunk.chunkIndex} of ${filename}: ${retryErr.message} — skipping chunk`);
          continue;
        }
      }

      await insertChunk(pool, documentId, chunk.content, chunk.chunkIndex, embedding);
      chunksIngested++;
      process.stdout.write(` done\n`);

      await sleep(RATE_LIMIT_MS);
    }

    console.log(`✓ ${filename} — ${chunksIngested} chunks ingested`);
    docsProcessed++;
    totalChunks += chunksIngested;
  }

  console.log(`\nIngest complete. ${docsProcessed} documents processed, ${totalChunks} total chunks.`);
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
