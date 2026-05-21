# 🐳 Docker Deployment - Fully Automated

## Quick Docker Setup

### Option 1: Using Docker Compose (Recommended)
```bash
# 1. Create .env file with API key
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# 2. Start everything (app + MongoDB)
docker-compose -f docker-compose.prod.yml up -d

# 3. Open browser
# http://localhost:3001
```

### Option 2: Manual Docker
```bash
# Build image
docker build -f Dockerfile.prod -t examflow-app .

# Run container
docker run -p 3001:3001 -p 5173:5173 \
  -e ANTHROPIC_API_KEY=your_key_here \
  examflow-app
```

---

## Docker Compose Setup (Full Stack)

### Files Provided
- `Dockerfile.prod` - Production container config
- `docker-compose.prod.yml` - Full stack setup

### Services Included
- **App**: Node.js backend + React frontend
- **MongoDB**: Database
- **Volumes**: Persistent data storage
- **Health checks**: Auto-restart on failure

### Commands

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Stop all services
docker-compose -f docker-compose.prod.yml down

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Rebuild container
docker-compose -f docker-compose.prod.yml up -d --build

# Remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.prod.yml down -v
```

---

## Prerequisites

- Docker installed (get from docker.com)
- Docker Compose installed (included with Docker Desktop)
- Anthropic API key

---

## Environment Setup

### Create .env for Docker
```bash
# .env
PORT=3001
MONGODB_URI=mongodb://mongo:27017/examflow
VITE_API_URL=http://localhost:3001/api
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

---

## Accessing the App

After running docker-compose:
- **Frontend**: http://localhost:3001
- **API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/api/health

---

## Monitoring

### View Logs
```bash
docker-compose -f docker-compose.prod.yml logs -f app
```

### Check Status
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Container Stats
```bash
docker stats
```

---

## Production Deployment

### On Cloud (AWS, Azure, GCP, Heroku)

1. **Build image**:
   ```bash
   docker build -f Dockerfile.prod -t examflow:latest .
   ```

2. **Push to registry**:
   ```bash
   docker tag examflow:latest your-registry/examflow:latest
   docker push your-registry/examflow:latest
   ```

3. **Deploy**:
   - Use cloud provider's container service
   - Configure environment variables
   - Set up MongoDB (managed service recommended)
   - Configure domain/SSL

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | Change port in compose file |
| MongoDB connection error | Wait 10s for MongoDB to start |
| API key not working | Add to .env and restart |
| Build fails | Run: docker-compose build --no-cache |
| Permissions denied | Add user to docker group or use sudo |

---

## Performance Tips

- Use Docker Desktop with sufficient RAM (4GB+)
- Enable BuildKit: `export DOCKER_BUILDKIT=1`
- Use Alpine base image (already used in Dockerfile)
- Enable Docker layer caching

---

## Security Notes

- Never commit .env file
- Use environment variables for secrets
- Set MongoDB authentication in production
- Use HTTPS in production
- Run containers as non-root user

---

## Docker Commands Reference

```bash
# Build
docker build -f Dockerfile.prod -t examflow .

# Run
docker run -p 3001:3001 examflow

# Compose up
docker-compose -f docker-compose.prod.yml up -d

# Compose down
docker-compose -f docker-compose.prod.yml down

# View logs
docker logs container_id

# Execute command
docker exec container_id npm run lint

# Push to registry
docker push registry/examflow:tag
```

---

## One-Command Full Setup

```bash
# Everything in one command (after getting API key)
echo "ANTHROPIC_API_KEY=your_key_here" > .env && \
docker-compose -f docker-compose.prod.yml up -d && \
echo "✅ App running at http://localhost:3001"
```

---

**Docker setup complete and fully automated!** 🐳
