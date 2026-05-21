# Production Checklist (Ops)

Use this as a quick runbook to deploy ExamFlow safely.

## 1. Required Environment Variables

Create a production env file (example: `.env.production`):

```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
CLIENT_ORIGIN=https://app.your-domain.com
EXAMFLOW_USERS_JSON=/etc/examflow/users.json
LLM_PROVIDER=bedrock
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

Notes:
- `EXAMFLOW_USERS_JSON` is required in production (server exits without it).
- `LLM_PROVIDER` supports `bedrock`, `anthropic`, or `local`.
- If you use Bedrock, provide AWS credentials using IAM role, `AWS_PROFILE`, or access keys.
- If you use direct Anthropic API instead, set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`.
- If frontend and backend are on different origins, keep CORS/cookie settings aligned and send requests with credentials from the frontend.

## 2. User Bootstrap File Example

Create the users file referenced by `EXAMFLOW_USERS_JSON`:

```json
[
  { "username": "admin", "password": "<strong-password>", "role": "admin" },
  { "username": "opsfaculty", "password": "<strong-password>", "role": "faculty" },
  { "username": "readonly", "password": "<strong-password>", "role": "view-only" }
]
```

## 3. Pre-Deploy Validation

Run from repo root:

```bash
npm ci
npm run ci
```

## 4. Deploy Option A: Docker

Build image:

```bash
docker build -t examflow:prod .
```

Run container:

```bash
docker run -d --name examflow \
  -p 3001:3001 \
  --env-file .env.production \
  -v /etc/examflow/users.json:/etc/examflow/users.json:ro \
  examflow:prod
```

## 5. Deploy Option B: Node Process (PM2)

Install production deps and build:

```bash
npm ci --omit=dev
npm run build
```

Start with PM2:

```bash
pm2 start server/index.js --name examflow --update-env
pm2 save
```

## 6. Post-Deploy Checks

Health check:

```bash
curl -i http://localhost:3001/api/health
```

Check logs:

```bash
docker logs --tail 200 examflow
```

Or (PM2):

```bash
pm2 logs examflow --lines 200
```

## 7. Cookie/CORS Quick Checklist

- `CLIENT_ORIGIN` matches deployed frontend URL exactly.
- Frontend requests use `credentials: 'include'`.
- Reverse proxy serves HTTPS and forwards host/proto headers.
- For cross-site cookies, use `SameSite=None; Secure`.

## 8. Rollback (Docker)

```bash
docker stop examflow
docker rm examflow
docker run -d --name examflow -p 3001:3001 --env-file .env.production <previous-image-tag>
```

## 9. Operational Reminders

- Rotate user passwords and API keys regularly.
- Monitor `/api/health` and HTTP error rates.
- Keep backup and restore plan for MongoDB.

## 10. LLM Provider Verification

### Bedrock (recommended alternative)

1. Verify env vars are present:

```bash
node ./scripts/check_bedrock.js
```

2. Perform a quick live Bedrock check (small quota usage):

```bash
# credentials can come from IAM role, AWS_PROFILE, or env keys
LLM_PROVIDER=bedrock AWS_REGION=us-east-1 node ./scripts/check_bedrock.js --test
```

Windows PowerShell example:

```powershell
$env:LLM_PROVIDER='bedrock'
$env:AWS_REGION='us-east-1'
$env:BEDROCK_MODEL_ID='anthropic.claude-3-5-sonnet-20241022-v2:0'
node ./scripts/check_bedrock.js --test
```

### Anthropic direct API (optional)

If you plan to use Anthropic Claude for syllabus extraction, verify the `ANTHROPIC_API_KEY` is available and functional.

1. Verify the env var is present:

```bash
# from the repo root
node ./scripts/check_anthropic.js || echo "set ANTHROPIC_API_KEY first"
```

2. Perform a quick live check (this will make a small API call). Requires Node 18+ for global `fetch`:

```bash
ANTHROPIC_API_KEY=sk-... node ./scripts/check_anthropic.js --test
# or on Windows PowerShell
$env:ANTHROPIC_API_KEY='sk-...'; node ./scripts/check_anthropic.js --test
```

Notes:
- The scripts exit with code `0` on success, `2` when required env is missing, and `3` on API error.
- Keep API keys and AWS credentials in a secrets manager and do not commit them to source control.
