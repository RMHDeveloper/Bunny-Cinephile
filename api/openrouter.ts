import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Free models on OpenRouter queue behind other users unpredictably - even a
// tiny prompt sometimes took 9s+. Racing several models in parallel (instead
// of trying one at a time, or relying on OpenRouter's own sequential "models"
// fallback) and taking whichever responds first substantially cuts the odds
// of any single attempt getting stuck behind a slow queue.
const OPENROUTER_MODELS = [
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

const REQUEST_TIMEOUT_MS = 9000;

async function callModel(model: string, prompt: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    signal,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://bunny-cinephile.vercel.app',
      'X-Title': 'Bunny Cinephile',
    },
    body: JSON.stringify({
      model,
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
    throw new Error(`${model} error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${model} returned an empty response.`);
  }
  return content;
}

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
    const content = await Promise.any(
      OPENROUTER_MODELS.map(model => callModel(model, prompt, apiKey, controller.signal))
    );
    res.status(200).json({ content });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      res.status(504).json({ error: `OpenRouter request timed out after ${REQUEST_TIMEOUT_MS}ms.` });
    } else if (err instanceof AggregateError) {
      const messages = err.errors.map((e: unknown) => (e instanceof Error ? e.message : String(e))).join('; ');
      res.status(502).json({ error: `All models failed: ${messages}` });
    } else {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  } finally {
    clearTimeout(timeoutId);
    controller.abort(); // stop any still-racing requests once we're done
  }
}
