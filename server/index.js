import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { getStorageMode, setStorageMode } from './storage/workspaceStore.js';
import { createApp } from './app.js';

dotenv.config();

const port = Number(process.env.PORT || 3001);
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/examflow';
const app = createApp();

const startServer = async () => {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log(`Connected to MongoDB at ${mongoUri}`);
    setStorageMode('mongo');

    // Cleanup stale unique index that is no longer in the schema
    try {
      const collection = mongoose.connection.collection('workspaces');
      const indexes = await collection.indexes();
      if (indexes.some((idx) => idx.name === 'userId_1')) {
        await collection.dropIndex('userId_1');
        console.log('Successfully dropped stale index userId_1');
      }
    } catch (err) {
      console.warn(`Could not drop stale index: ${err.message}`);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`MongoDB unavailable in production: ${error.message}`);
      process.exit(1);
    }

    console.warn(`MongoDB unavailable, using local file storage: ${error.message}`);
    setStorageMode('file');
  }

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port} (${getStorageMode()} storage)`);
  });
};

startServer();
