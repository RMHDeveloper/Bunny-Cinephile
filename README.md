<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/19509ae7-3b39-4ccb-baed-8e7d8bb3b6dc

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set `OPENROUTER_API_KEY` in `.env.local` to your OpenRouter API key (get one at https://openrouter.ai)
3. Run the app:
   - `npm run dev` — frontend only (Vite). Movie recommendations will fall back to mock data since `/api/openrouter` isn't served.
   - `npm run dev:full` — frontend + the `/api/openrouter` serverless function via the Vercel CLI, for real recommendations locally.

The OpenRouter call and API key live server-side in [api/openrouter.ts](api/openrouter.ts), never in the browser bundle.
