import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import workspaceRoutes from './routes/workspace.js';
import generateRoutes from './routes/generate.js';
import authRoutes from './routes/auth.js';
import syllabusRoutes from './routes/syllabus.js';
import { getStorageMode } from './storage/workspaceStore.js';
import { basicRateLimit } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/requestLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '..', 'dist');

export const createApp = (config = {}) => {
  const app = express();
  const isLocalOrigin = (origin) => {
    if (!origin) return true;
    const localRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    return localRegex.test(origin);
  };

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use(cors({
    origin: (origin, callback) => {
      // Allow any local origin for development, plus specific production origins
      const allowedInConfig = (config.allowedOrigins || [process.env.CLIENT_ORIGIN]).filter(Boolean);
      
      if (isLocalOrigin(origin) || allowedInConfig.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS blocked for this origin.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));
  app.use(requestLogger);
  app.use('/api', basicRateLimit);

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      storageMode: getStorageMode(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/workspace', workspaceRoutes);
  app.use('/api/generate', generateRoutes);
  app.use('/api/syllabus', syllabusRoutes);

  app.use(express.static(clientDistPath));

  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API route not found.' });
  });

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && fs.existsSync(clientDistPath)) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
      return;
    }

    next();
  });

  app.use((error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const status = error?.statusCode || error?.status || 500;
    const message = status < 500
      ? (error?.message || 'Request failed.')
      : 'Internal server error.';

    console.error(JSON.stringify({
      level: 'error',
      status,
      message: error?.message || 'Unknown error',
      at: new Date().toISOString(),
    }));

    res.status(status).json({ message });
  });

  return app;
};
