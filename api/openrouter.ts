import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = 'You are a JSON API. Respond with ONLY valid JSON matching the shape requested by the user. No markdown, no code fences, no commentary before or after the JSON.';

// Fast, non-reasoning-by-default free-tier model - raced alongside OpenRouter's
// reasoning models below to compare real-world speed/reliability. Note:
// thinkingConfig/thinkingBudget is NOT set here - passing thinkingBudget: 0
// made this model reject the request outright (400 INVALID_ARGUMENT), likely
// because -lite doesn't support configurable thinking. It's non-reasoning by
// default anyway, so this is unneeded.
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

// Gemini normally answers in 1-4s - a short, dedicated timeout lets a genuine
// failure (down, rate-limited) fall through to the OpenRouter race quickly,
// instead of eating a large chunk of the shared 55s budget first.
const GEMINI_TIMEOUT_MS = 7000;

async function callGemini(prompt: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      abortSignal: signal,
    },
  });

  const content = response.text;
  if (!content) {
    throw new Error('gemini returned an empty response.');
  }
  return content;
}

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

// Measured directly against OpenRouter's free tier: a real 10-movie structured
// prompt reliably takes 35-46s (these free models emit thousands of internal
// reasoning tokens before answering, and the shared free pool queues on top of
// that), and the heavier final-recommendation prompt can run longer still.
// This is now the fallback path only (Gemini is tried first, above), so on
// Vercel it's kept just under 45s - GEMINI_TIMEOUT_MS (7s) + this must stay
// safely under Vercel's 60s Hobby-plan maxDuration (see vercel.json), or the
// platform kills the function before this code's own graceful error response
// can be sent. Locally (plain `vite`/`vite dev`, no Vercel maxDuration to
// respect) there's no such ceiling, so give slow free models more room there
// rather than surfacing a false-positive timeout.
const REQUEST_TIMEOUT_MS = process.env.VERCEL ? 45000 : 90000;

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
      reasoning: { effort: 'low' },
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
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
  const geminiApiKey = process.env.GEMINI_API_KEY;

  const { prompt } = req.body ?? {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Missing "prompt" string in request body.' });
    return;
  }

  // Try Gemini first with its own short timeout - if it works (the common
  // case), the 3 OpenRouter calls are never made at all, saving that shared
  // free-tier quota. Only falls through to racing OpenRouter on failure.
  if (geminiApiKey) {
    const geminiController = new AbortController();
    const geminiTimeoutId = setTimeout(() => geminiController.abort(), GEMINI_TIMEOUT_MS);
    try {
      const content = await callGemini(prompt, geminiApiKey, geminiController.signal);
      console.log('/api/openrouter: "gemini" served the request (primary).');
      res.status(200).json({ content });
      return;
    } catch (err) {
      console.warn(`/api/openrouter: gemini failed/timed out, falling back to OpenRouter race: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(geminiTimeoutId);
    }
  } else {
    console.warn('GEMINI_API_KEY not set - racing OpenRouter models only.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const winner = await Promise.any(
      OPENROUTER_MODELS.map(model =>
        callModel(model, prompt, apiKey, controller.signal).then(content => ({ source: model, content }))
      )
    );
    console.log(`/api/openrouter: "${winner.source}" won the OpenRouter fallback race.`);
    res.status(200).json({ content: winner.content });
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
