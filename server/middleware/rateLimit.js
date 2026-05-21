const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 120;
const bucket = new Map();

const cleanup = (now) => {
  for (const [key, value] of bucket.entries()) {
    if (value.resetAt <= now) {
      bucket.delete(key);
    }
  }
};

export const basicRateLimit = (req, res, next) => {
  const now = Date.now();
  cleanup(now);

  const key = `${req.ip || 'unknown'}:${req.path}`;
  const current = bucket.get(key);

  if (!current || current.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (current.count >= MAX_REQUESTS) {
    res.status(429).json({ message: 'Rate limit exceeded. Try again shortly.' });
    return;
  }

  current.count += 1;
  next();
};
