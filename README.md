# TaskFlow

[![CI](https://github.com/aliou21toure-jpg/taskflow/actions/workflows/ci.yml/badge.svg)](https://github.com/aliou21toure-jpg/taskflow/actions/workflows/ci.yml)

A full-stack task manager: a **TypeScript + Express REST API** backed by **PostgreSQL**, and a **React** frontend.

![TaskFlow running locally: tasks with priorities, assignees, due dates and status counts](docs/screenshot.png)

## Features

- CRUD REST API for tasks: status, priority, assignee, due date
- Filtering (`status`, `priority`, `assignee`), full-text-style search (`q`), sorting and pagination
- Input validation with Zod — strict schemas reject unknown fields (mass-assignment protection)
- Parameterized SQL everywhere (SQL-injection safe), including escaped `LIKE` wildcards
- Consistent JSON error format, structured request logging (pino), security headers (helmet)
- Graceful shutdown, health check that verifies the database
- React UI: create, filter, search, sort, change status, delete, live status counts
- **34 automated tests**: 30 API integration tests against a real PostgreSQL test database + 4 UI tests
- Docker images, Docker Compose for the full stack, GitHub Actions CI

## Architecture

```
React (Vite)  ──HTTP/JSON──▶  Express app  ──▶  routes/tasks.ts  (validate with Zod)
                                                     │
                                                     ▼
                                           lib/taskRepository.ts (parameterized SQL)
                                                     │
                                                     ▼
                                               PostgreSQL 16
```

| Layer | File | Responsibility |
|---|---|---|
| Config | `api/src/config.ts` | Validate environment variables, fail fast |
| HTTP | `api/src/app.ts` | Middleware, CORS, health check, error handling |
| Routes | `api/src/routes/tasks.ts` | Parse input → call repository → shape response |
| Data | `api/src/lib/taskRepository.ts` | All SQL for tasks |
| Schema | `api/sql/001_create_tasks.sql` | Table, constraints, indexes, `updated_at` trigger |

## API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Database connectivity check |
| `POST` | `/tasks` | Create a task |
| `GET` | `/tasks` | List tasks — `?status=&priority=&assignee=&q=&sort=&order=&limit=&offset=` |
| `GET` | `/tasks/stats` | Count of tasks per status |
| `GET` | `/tasks/:id` | Get one task |
| `PATCH` | `/tasks/:id` | Update some fields |
| `DELETE` | `/tasks/:id` | Delete a task |

Errors always look like `{ "error": { "message": "...", "details": [...] } }`.

## Run it

**With Docker (everything):**
```bash
docker compose up --build
# UI  → http://localhost:5173
# API → http://localhost:3000/health
```

**Locally (for development):**
```bash
docker compose up -d db          # PostgreSQL only
cd api
cp .env.example .env && cp .env.test.example .env.test
npm install
npm run db:migrate && npm run db:migrate:test
npm run dev                      # API on :3000

cd ../web
cp .env.example .env
npm install
npm run dev                      # UI on :5173
```

## Tests

```bash
cd api && npm test        # integration tests (needs the taskflow_test database)
cd web && npm test        # React component tests (no backend needed)
```

The API tests refuse to run unless `DATABASE_URL` points at a database whose name ends in `_test`, because they truncate tables.

## Tech stack

TypeScript · Node.js 24 · Express 5 · PostgreSQL 16 · node-postgres · Zod · Vitest · Supertest · React 19 · Vite · Testing Library · Docker · GitHub Actions
