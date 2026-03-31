import pg from 'pg';
import { toSql } from 'pgvector/pg';

const { Pool } = pg;

export async function createPool(databaseURL) {
  const pool = new Pool({ connectionString: databaseURL });
  // Verify connection
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
  return pool;
}

export async function documentExists(pool, filename) {
  const result = await pool.query(
    'SELECT 1 FROM documents WHERE filename = $1',
    [filename]
  );
  return result.rowCount > 0;
}

export async function insertDocument(pool, filename, title) {
  const result = await pool.query(
    'INSERT INTO documents (filename, title) VALUES ($1, $2) RETURNING id',
    [filename, title]
  );
  return result.rows[0].id;
}

export async function insertChunk(pool, documentId, content, chunkIndex, embedding) {
  await pool.query(
    `INSERT INTO chunks (document_id, content, chunk_index, token_count, embedding)
     VALUES ($1, $2, $3, $4, $5)`,
    [documentId, content, chunkIndex, content.length, toSql(embedding)]
  );
}
