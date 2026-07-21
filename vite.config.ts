import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// OPENROUTER_API_KEY is read server-side only, by api/openrouter.ts (a Vercel
// serverless function) - it must never be baked into the client bundle here.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
