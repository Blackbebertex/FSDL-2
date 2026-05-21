# ExamFlow MERN Timetable App

ExamFlow is a full-stack exam scheduling app with role-based access, per-user workspaces, timetable generation, seat allotment reports, and export/sharing features.

## What is implemented

- Login with roles: `admin`, `faculty`, `view-only`
- Multi-workspace support (title + semester per owner)
- CRUD for exams and rooms (add, edit, delete)
- Student roster import/export via CSV (`exam,student`)
- Timetable generation with:
  - per-exam duration support
  - manual lock/pin (exam to slot)
  - conflict trace output
- Seat allotment output (`student -> room`) plus room-wise and student-wise reports
- Session/slot configurator:
  - date range
  - slots/day
  - custom time windows
- Better exports:
  - CSV for timetable and seat plan
  - print-ready pages (browser print / Save as PDF)
  - shareable read-only links
- Better conflict UX:
  - reason trace from scheduler
  - suggested fixes in UI
- Undo/redo and destructive action confirms
- Backend hardening:
  - auth checks on APIs
  - payload validation
  - stricter CORS
  - basic rate limiting
  - server-side audit trail per workspace
  - structured request logging + request IDs
- Engineering polish:
  - automated lint/test/build scripts
  - GitHub Actions CI workflow
  - Dockerfile and deployment notes
  - fixed garbled separators (`-` used instead of corrupted glyphs)

## Demo credentials

If `EXAMFLOW_USERS_JSON` is not configured, these fallback users are available:

- `admin` / `admin123`
- `faculty` / `faculty123`
- `viewer` / `viewer123`

Note: These **demo credentials are for local development only**. In production you must set `EXAMFLOW_USERS_JSON` to point to a proper user configuration or integrate a user management system.

## Stack

- React 19 + Vite
- Node.js + Express 5
- MongoDB + Mongoose
- date-fns for scheduling constraints

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create `.env` from `.env.example` and configure values.

```bash
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/examflow
VITE_API_URL=http://localhost:3001/api
CLIENT_ORIGIN=http://localhost:5173
EXAMFLOW_USERS_JSON=

Note: The server issues an httpOnly cookie named `examflow.session` for authenticated sessions. Client requests that rely on the cookie must use `fetch`/XHR with credentials (e.g. `credentials: 'include'`). The server remains backward-compatible with bearer tokens sent in the `Authorization` header.
```

3. Start development servers.

```bash
npm run dev
```

## Scripts

- `npm run dev` start frontend + backend
- `npm run lint` lint all files
- `npm run test` run node tests
- `npm run build` production build
- `npm run ci` lint + test + build
- `npm start` start backend server

## API overview

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/workspace/list`
- `POST /api/workspace/list`
- `GET /api/workspace/:workspaceId`
- `PUT /api/workspace/:workspaceId`
- `PATCH /api/workspace/:workspaceId/meta`
- `DELETE /api/workspace/:workspaceId`
- `POST /api/workspace/:workspaceId/share`
- `POST /api/workspace/:workspaceId/generate`
- `GET /api/workspace/:workspaceId/reports`
- `GET /api/workspace/shared/:token`
- `GET /api/health`

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).
