import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import workspaceRoutes from './routes/workspaceRoutes.js';
import { getStorageMode, setStorageMode } from './storage/workspaceStore.js';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT || 3001);
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/examflow';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.use('/api/workspace', workspaceRoutes);

app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && fs.existsSync(clientDistPath)) {
    res.sendFile(path.join(clientDistPath, 'index.html'));
    return;
  }

  next();
});

const startServer = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB at ${mongoUri}`);
    setStorageMode('mongo');
  } catch (error) {
    console.warn(`MongoDB unavailable, using local file storage: ${error.message}`);
    setStorageMode('file');
  }

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port} (${getStorageMode()} storage)`);
  });
};

startServer();