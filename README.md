# ExamFlow MERN Timetable App

ExamFlow is now a full-stack MERN project built with React, Node.js, Express, and MongoDB. The React UI manages exams, rooms, holidays, profiles, and timetable generation. The backend persists the full workspace in MongoDB and exposes API endpoints for loading, saving, and generating timetables.

## Stack

- React 19 + Vite
- Node.js + Express 5
- MongoDB + Mongoose
- date-fns for slot and calendar logic

## Setup

1. Install dependencies.

```bash
npm install
```

1. Create a `.env` file from `.env.example` and update the MongoDB connection if needed.

```bash
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/examflow
VITE_API_URL=http://localhost:3001/api
```

1. Start MongoDB locally, or point `MONGODB_URI` at your cloud cluster.

1. Run the app in development mode.

```bash
npm run dev
```

This starts the Vite client and the Express API together.

## Scripts

- `npm run dev` starts client and server together.
- `npm run dev:client` starts only the Vite frontend.
- `npm run dev:server` starts only the Express API with watch mode.
- `npm run build` produces the production frontend bundle.
- `npm start` runs the production Express server.

## API

- `GET /api/health` checks the server.
- `GET /api/workspace` loads the saved MongoDB workspace.
- `PUT /api/workspace` saves the full workspace.
- `POST /api/workspace/generate` generates and stores a timetable.

## Notes

- If MongoDB is unavailable, the React app still falls back to browser storage for local work.
- The workspace payload now includes exams, rooms, slots, timetable, constraints, holidays, theme, density, saved profiles, and audit history.
