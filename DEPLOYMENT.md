# Deployment and Ops

## Local Docker

```bash
docker build -t examflow:latest .
docker run --rm -p 3001:3001 \
  -e PORT=3001 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/examflow \
  -e CLIENT_ORIGIN=http://localhost:5173 \
  examflow:latest
```

## Production Checklist

- Configure `MONGODB_URI` to managed MongoDB.
- Set `CLIENT_ORIGIN` to your frontend domain.
- Use `EXAMFLOW_USERS_JSON` for role-based user bootstrap.
- Monitor JSON logs (stdout) from `requestLogger`.
- Configure reverse proxy TLS (Nginx, Caddy, or cloud ingress).
 - Ensure `EXAMFLOW_USERS_JSON` is provided in production. The server will exit in production if no users configuration is supplied to avoid unsecured fallback users.
 - Configure cookies for production:
   - Server issues an httpOnly cookie named `examflow.session`. When front and backends are on different origins set `CLIENT_ORIGIN` and configure CORS to allow credentials.
   - Behind HTTPS, set cookie `secure` to true. If using cross-site cookies, set `SameSite=None; Secure` on the cookie and ensure the frontend uses `credentials: 'include'`.
 - If deploying via a reverse proxy, ensure it forwards TLS and hostname correctly so `secure` cookie semantics work and CORS origin checks are accurate.

## Health and Monitoring

- Health endpoint: `GET /api/health`
- Request IDs: `X-Request-Id` response header
- Structured HTTP logs include: method, path, statusCode, latencyMs

## Suggested Managed Deployment

- Frontend: Vercel/Netlify for static Vite `dist`
- Backend: Render/Fly.io/VM container running this Dockerfile
- Database: MongoDB Atlas
