# Task tracker

Two services for the DevOps final project: a backend API and a frontend page, with one shared PostgreSQL database. Dockerfiles, image scanning, and the AWS network are owned by other members. This repository fixes the names they build on.

## Contract

| Item | Value |
| --- | --- |
| Backend | `services/backend`, port `3000`, `node src/server.js` |
| Backend health | `GET /api/health` returns `200` `{"status":"ok","service":"backend"}` and does not touch the database |
| Database health | `GET /api/health/db` returns `200` when Postgres answers, `503` when it does not |
| Tasks API | `GET` and `POST /api/tasks`, `PATCH /api/tasks/:id` with `{"done":true}`, `DELETE /api/tasks/:id` returns `204` |
| Frontend | `services/frontend`, port `8080`, `node src/server.js` |
| Frontend health | `GET /health` returns `200` `{"status":"ok","service":"frontend"}` |
| Routing | `/api/*` goes to the backend. Everything else goes to the frontend |
| Node.js | 24 |

The page calls `/api/tasks` on the same host. It never contains a backend address. Locally, set `BACKEND_URL` and the frontend forwards `/api` to the backend. On AWS the load balancer does that routing, so `BACKEND_URL` is only for local runs.

## Environment variables

Backend:

| Variable | Local example | On AWS |
| --- | --- | --- |
| `PORT` | `3000` | `3000` |
| `DB_HOST` | `localhost` | RDS endpoint. Inside Compose this is the database service name, such as `db`, not `localhost` |
| `DB_PORT` | `5432` | `5432` |
| `DB_NAME` | `tasks` | `tasks` |
| `DB_USER` | `app` | omitted when `DB_SECRET_NAME` is set |
| `DB_PASSWORD` | `change-me` | omitted when `DB_SECRET_NAME` is set |
| `DB_SECRET_NAME` | unset | Secrets Manager ARN created by RDS. The instance role reads it |
| `DB_SSL` | `false` | `true` |
| `AWS_REGION` | unset | the stack region |

Frontend: `PORT` and `BACKEND_URL`. Copy `services/backend/.env.example` to `services/backend/.env` for a laptop. Never commit `.env`. The password is a local placeholder.

When `DB_SECRET_NAME` is set, `src/config.js` reads the username and password from Secrets Manager at startup. Host and database name still come from `DB_HOST` and `DB_NAME` unless the secret itself contains them. The RDS CA bundle in `services/backend/certs/rds-global-bundle.pem` is the public AWS bundle used when `DB_SSL=true`.

The backend creates the `tasks` table when it starts. There is no separate schema file.

## Run locally

Requires Node.js 24 and Docker.

```bash
docker run --name tasks-db -d -p 5432:5432 \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=change-me -e POSTGRES_DB=tasks \
  postgres:17-alpine

cd services/backend
npm install
cp .env.example .env
node --env-file=.env src/server.js
```

In a second terminal:

```bash
cd services/frontend
npm install
BACKEND_URL=http://localhost:3000 node src/server.js
```

Open `http://localhost:8080`. Check the health endpoints:

```bash
curl localhost:3000/api/health
curl localhost:3000/api/health/db
curl localhost:8080/health
```

Stopping the database container makes `/api/health/db` return 503. `/api/health` still returns 200.

## Tests, lint, and format

From each service directory:

```bash
npm test
npm run lint
npm run format:check
```

`npm test` does not need Postgres. It prints a coverage table and writes `coverage/lcov.info`. Line coverage below 70 percent fails the run. Paths for SonarCloud:

- `services/backend/coverage/lcov.info`
- `services/frontend/coverage/lcov.info`

CI job names, in order:

1. `3. Lint (ESLint)`
2. `4. Format check (Prettier)`
3. `6. Unit tests (Jest)`

## Branching strategy

- `main` always holds working code that can be deployed. It is protected: nobody can push to it directly.
- All work happens on short-lived branches created from `main`:
  - `feature/<short-description>` for new work, for example `feature/backend-api`
  - `fix/<short-description>` for bug fixes
  - `docs/<short-description>` for documentation only
- When the work is ready, open a pull request into `main`.
- A pull request can be merged only when:
  1. at least one other group member has approved it, and
  2. every CI check has passed.
- Nobody approves their own pull request.
- Merged branches are deleted automatically.
- Commit messages follow the pattern `type(scope): summary`, for example `feat(backend): add tasks endpoint` or `fix(frontend): show error message`. Common types: feat, fix, test, docs, ci, chore.

### Review rotation

| Author | Reviewer |
| --- | --- |
| Hadi | Muneeb |
| Abdullah | Hadi |
| Ahmed | Abdullah |
| Hassaan | Ahmed |
| Muneeb | Hassaan |
# DevOps_Final_project
