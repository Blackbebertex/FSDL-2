import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUserById } from './users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sessionsFilePath = path.resolve(__dirname, '..', 'data', 'sessions.local.json');

const TOKEN_TTL_MS = 1000 * 60 * 60 * 8;
const sessions = new Map();

const now = () => Date.now();

const saveSessions = () => {
  try {
    const data = JSON.stringify(Array.from(sessions.entries()), null, 2);
    if (!fs.existsSync(path.dirname(sessionsFilePath))) {
      fs.mkdirSync(path.dirname(sessionsFilePath), { recursive: true });
    }
    fs.writeFileSync(sessionsFilePath, data, 'utf8');
  } catch (err) {
    console.error('Failed to save sessions:', err.message);
  }
};

const loadSessions = () => {
  try {
    if (fs.existsSync(sessionsFilePath)) {
      const data = fs.readFileSync(sessionsFilePath, 'utf8');
      const entries = JSON.parse(data);
      for (const [token, session] of entries) {
        if (session.expiresAt > now()) {
          sessions.set(token, session);
        }
      }
      console.log(`Restored ${sessions.size} active sessions from disk.`);
    }
  } catch (err) {
    console.warn('Failed to load sessions:', err.message);
  }
};

// INITIAL LOAD
loadSessions();

export const createSession = (user) => {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, {
    userId: user.id,
    expiresAt: now() + TOKEN_TTL_MS,
  });
  saveSessions();
  return token;
};

export const resolveSession = (token) => {
  const current = sessions.get(token);
  if (!current) return null;

  if (current.expiresAt <= now()) {
    sessions.delete(token);
    saveSessions();
    return null;
  }

  const user = getUserById(current.userId);
  if (!user) {
    sessions.delete(token);
    saveSessions();
    return null;
  }

  return user;
};

export const removeSession = (token) => {
  if (sessions.has(token)) {
    sessions.delete(token);
    saveSessions();
  }
};
