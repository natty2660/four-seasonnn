import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './src/server/routes.ts';
import { initPostgresDatabase } from './src/server/db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static assets from public
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// Mount API routes
app.use('/api', apiRouter);

// Configure Vite in dev OR static build in production
async function setupServer() {
  // Initialize PostgreSQL database connection and sync state
  await initPostgresDatabase().catch((err) => {
    console.warn('Postgres startup note:', err.message);
  });

  if (!isProduction) {
    // Dev mode with Vite middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`☕ Prime Cafe server running on http://0.0.0.0:${PORT}`);
    console.log(`📱 Digital menu: http://0.0.0.0:${PORT}/menu/prime-cafe`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to initialize server:', err);
  process.exit(1);
});

export default app;
