import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env / .env.local
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: '.',
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            supabase: ['@supabase/supabase-js']
          }
        }
      }
    },
    server: {
      port: 5173,
      open: true
    },
    plugins: [
      {
        name: 'r2-serverless-dev-api',
        configureServer(server) {
          // Expose loaded env vars to process.env in Vite dev server
          Object.assign(process.env, env);

          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/api/r2-presign') && req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => { body += chunk; });
              req.on('end', async () => {
                try {
                  req.body = body ? JSON.parse(body) : {};
                  res.status = (code) => { res.statusCode = code; return res; };
                  res.json = (data) => {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  };
                  const { default: handler } = await import('./api/r2-presign.js');
                  await handler(req, res);
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
              return;
            }

            if (req.url?.startsWith('/api/r2-delete') && req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => { body += chunk; });
              req.on('end', async () => {
                try {
                  req.body = body ? JSON.parse(body) : {};
                  res.status = (code) => { res.statusCode = code; return res; };
                  res.json = (data) => {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  };
                  const { default: handler } = await import('./api/r2-delete.js');
                  await handler(req, res);
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
              return;
            }

            next();
          });
        }
      }
    ]
  };
});
