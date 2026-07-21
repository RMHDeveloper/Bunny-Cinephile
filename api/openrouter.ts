import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Pinned to specific free models instead of the "openrouter/free" auto-router,
// which was inconsistently routing requests to slow reasoning models and even
// a content-safety classifier unsuited for generating movie data. Listed in
// priority order; OpenRouter fails over to the next one automatically.
const OPENROUTER_MODELS = [
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

const REQUEST_TIMEOUT_MS = 4000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured on the server.' });
    return;
  }

  const { prompt } = req.body ?? {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Missing "prompt" string in request body.' });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bunny-cinephile.vercel.app',
        'X-Title': 'Bunny Cinephile',
      },
      body: JSON.stringify({
        models: OPENROUTER_MODELS,
        messages: [
          {
            role: 'system',
            content: 'You are a JSON API. Respond with ONLY valid JSON matching the shape requested by the user. No markdown, no code fences, no commentary before or after the JSON.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      res.status(502).json({ error: `OpenRouter API error (${response.status}): ${errText}` });
      return;
    }

    const data = await response.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: 'Empty response from OpenRouter API.' });
      return;
    }

    res.status(200).json({ content });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      res.status(504).json({ error: `OpenRouter request timed out after ${REQUEST_TIMEOUT_MS}ms.` });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  } finally {
    clearTimeout(timeoutId);
  }
}
