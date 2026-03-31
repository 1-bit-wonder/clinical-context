const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const FETCH_TIMEOUT_MS = 30_000;

export async function embed(text, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: [text], model: 'voyage-3' }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '(unreadable)');
    throw new Error(`Voyage API error ${response.status}: ${body}`);
  }

  const json = await response.json();
  return json.data[0].embedding;
}
