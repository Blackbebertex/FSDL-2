export const requestLogger = (req, res, next) => {
  const startedAt = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const latencyMs = Date.now() - startedAt;
    const line = JSON.stringify({
      level: 'info',
      type: 'http',
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      latencyMs,
      at: new Date().toISOString(),
    });

    console.log(line);
  });

  next();
};
