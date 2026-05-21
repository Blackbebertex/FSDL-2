import { Router } from 'express';
import { authenticateUser } from '../auth/users.js';
import { createSession, removeSession } from '../auth/sessions.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const COOKIE_NAME = 'examflow.session';
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 1000 * 60 * 60 * 8,
});

router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    res.status(400).json({ message: 'Username and password are required.' });
    return;
  }

  const user = authenticateUser(username, password);
  if (!user) {
    res.status(401).json({ message: 'Invalid credentials.' });
    return;
  }

  const token = createSession(user);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ token, user });
});

router.post('/logout', requireAuth, (req, res) => {
  removeSession(req.authToken);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
