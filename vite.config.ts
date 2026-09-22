import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// DASHBOARD_PROXY_URL / DASHBOARD_PROXY_SECRET are read server-side only, by
// api/openrouter.ts (a Vercel serverless function) - they must never be baked
// into the client bundle here.

// `vercel dev` needs an interactive account login, which isn't available in
// every environment. This plugin runs the same api/openrouter.ts handler
// in-process under plain `vite`/`vite dev`, so /api/openrouter works locally
// without the Vercel CLI.
function localApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'local-openrouter-api',
    apply: 'serve',
    configureServer(server) {
      if (env.DASHBOARD_PROXY_URL) process.env.DASHBOARD_PROXY_URL = env.DASHBOARD_PROXY_URL;
      if (env.DASHBOARD_PROXY_SECRET) process.env.DASHBOARD_PROXY_SECRET = env.DASHBOARD_PROXY_SECRET;

      server.middlewares.use('/api/openrouter', async (req: any, res: any) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString('utf-8');
        try {
          req.body = raw ? JSON.parse(raw) : {};
        } catch {
          req.body = {};
        }

        res.status = (code: number) => { res.statusCode = code; return res; };
        res.json = (payload: unknown) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
        };

        const mod = await server.ssrLoadModule('/api/openrouter.ts');
        await mod.default(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), localApiPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
