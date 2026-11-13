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

## Run the stack locally

You need Docker Desktop (or any Docker Engine with the Compose plugin). From the repository root:

```bash
docker compose up --build -d
```

Open http://localhost:8080. `docker compose ps` should show `db`, `backend` and `frontend` as healthy after about 20 seconds.

| Command | What it does |
| --- | --- |
| `docker compose logs -f backend` | Follow the backend logs |
| `docker compose down` | Stop everything, keep the data |
| `docker compose down -v` | Stop everything and delete the database |
| `./scripts/build-and-test.sh` | Run every check the pipeline runs, then build both images |

The local database password defaults to `change-me`. Set `DB_PASSWORD` in your shell to use another one. It exists only on your machine.

Inside Compose the services find each other by service name on a private network: the backend reaches PostgreSQL at `db:5432`, and the frontend forwards `/api` to `http://backend:3000`. Only the frontend (port 8080) is published to the network; the backend is published on `127.0.0.1:3000` for testing with curl, and the database is not published at all.

## Containers and images

| Item | Value |
| --- | --- |
| Dockerfiles | `services/backend/Dockerfile`, `services/frontend/Dockerfile`: multi-stage, `node:24.22.3-alpine3.24` (pinned), run as user `1000`, no npm in the final image, built-in `HEALTHCHECK` |
| Build context filter | `.dockerignore` in each service folder keeps `node_modules`, tests, coverage and `.env` files out of the images |
| Local stack | `docker-compose.yml`: PostgreSQL 17, backend, frontend |
| Production stack | `docker-compose.prod.yml`: pulls both images from ECR at one tag, reads the database password from Secrets Manager, logs to CloudWatch with the `awslogs` driver |
| ECR repositories | `devops-task-tracker/backend`, `devops-task-tracker/frontend`, tag immutability on |
| Image tags | `sha-<7-character commit SHA>` and `v<VERSION>.<pipeline run number>`, for example `sha-1a2b3c4` and `v1.0.57`. `VERSION` holds the major and minor numbers. No `latest` tag is ever pushed |
| Instance startup | `deploy/bootstrap.sh` is the launch template user data. It reads the live tag from Parameter Store (`/devops-task-tracker/image-tag`) plus that tag's Compose file (`/devops-task-tracker/compose/<sha-tag>`), then pulls and starts the containers |
| Manual rollback | Actions tab, `Manual rollback`, type a `sha-` or `v` tag. `scripts/resolve-tag.sh` checks the tag exists in ECR before anything changes |

## Run without Docker (for development)

Requires Node.js 24 and Docker (for the database only).

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
3. `5. Dockerfile lint (Hadolint)` (also runs ShellCheck on `scripts/` and `deploy/`)
4. `6. Unit tests (Jest)`
5. `9. Build images`
6. `10. Image scan (Trivy)`: fails on any fixable HIGH or CRITICAL vulnerability
7. `11. Push images to ECR`: runs only on a push to `main`

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
