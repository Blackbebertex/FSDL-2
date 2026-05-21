import { resolveSession } from '../auth/sessions.js';

const COOKIE_NAME = 'examflow.session';

const parseCookieHeader = (headerValue) => {
  if (!headerValue || typeof headerValue !== 'string') return {};

  return headerValue.split(';').reduce((cookies, pair) => {
    const index = pair.indexOf('=');
    if (index < 0) return cookies;

    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
    return cookies;
  }, {});
};

const parseBearerToken = (headerValue) => {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token.trim();
};

const resolveAuthToken = (req) => {
  const bearerToken = parseBearerToken(req.header('Authorization'));
  if (bearerToken) return bearerToken;

  const cookies = parseCookieHeader(req.header('Cookie'));
  return cookies[COOKIE_NAME] || null;
};

export const requireAuth = (req, res, next) => {
  const token = resolveAuthToken(req);
  if (!token) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const user = resolveSession(token);
  if (!user) {
    res.status(401).json({ message: 'Session expired or invalid.' });
    return;
  }

  req.user = user;
  req.authToken = token;
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  if (!roles.includes(req.user.role)) {
    res.status(403).json({ message: 'You do not have access to this action.' });
    return;
  }

  next();
};
