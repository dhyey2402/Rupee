import 'dotenv/config';
import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './server/db.js';
import { apiRouter } from './server/api.js';
import { setupGeminiLiveServer } from './server/gemini.js';
import { initTursoSync, scheduleTursoSync } from './server/turso.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Initialize SQLite database
  initDatabase();
  await initTursoSync();

  // Enable CORS for mobile app and external clients
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // Mount API router
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (
        ['POST', 'PUT', 'DELETE'].includes(req.method) &&
        res.statusCode >= 200 &&
        res.statusCode < 300 &&
        req.path.startsWith('/api') &&
        !req.path.includes('/gemini')
      ) {
        scheduleTursoSync();
      }
    });
    next();
  });

  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }
 
  const httpServer = http.createServer(app);

  // Setup WebSocket server for Gemini Live API real-time voice conversations
  setupGeminiLiveServer(httpServer);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Rupee. server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
