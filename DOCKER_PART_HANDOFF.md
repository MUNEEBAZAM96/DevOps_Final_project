# Docker part: what was done and what you still need to do

## What the project is

A DevOps final project (FAST-NU, BCE 7A/7B, Fall 2026): a small **Task Tracker** app (Express backend on port 3000, Express frontend on port 8080, PostgreSQL 17) deployed on AWS with a 12-stage DevSecOps pipeline. The app is only the vehicle; marks are for containers, CI/CD, security, high availability, scaling, monitoring and documentation.

Work split (from the group's guides): Muneeb = app (done), **Hadi = Containers and Images (this part)**, Abdullah = security/IAM/secrets, Ahmed = AWS network/ASG/ALB/deploy, Hassaan = monitoring/smoke test.

## What is now in the repository (all staged in git, not committed)

| File | Purpose |
| --- | --- |
| `services/backend/Dockerfile`, `services/frontend/Dockerfile` | Multi-stage, pinned `node:24.22.3-alpine3.24` (newest Node 24 Alpine tag today), user 1000, npm removed from runtime, root-owned read-only app files, `HEALTHCHECK` |
| `services/*/.dockerignore` | Keeps node_modules, tests, coverage, `.env` out of images |
| `docker-compose.yml` | Whole stack with one command: `docker compose up --build -d` (Postgres pinned to `17.12-alpine3.24`) |
| `docker-compose.prod.yml` | EC2 variant: images from ECR, password from Secrets Manager, logs to CloudWatch (1.3 KB, under the 4 KB SSM limit) |
| `VERSION` | `1.0`; image tags are `sha-<7 chars>` and `v1.0.<run number>` |
| `.github/workflows/ci.yml` | Added stage 5 (Hadolint + ShellCheck), 9 (build), 10 (Trivy, fails on HIGH/CRITICAL), 11 (push to ECR on main via OIDC + store Compose file in SSM) |
| `.github/workflows/rollback.yml` | Manual rollback by image tag |
| `scripts/build-and-test.sh` | Runs lint, format, tests, Hadolint, ShellCheck, then builds both images |
| `scripts/resolve-tag.sh` | Validates a rollback tag and finds its `sha-` tag in ECR |
| `deploy/bootstrap.sh` | EC2 launch-template user data: installs Docker + Compose v5.7.1 (checksum verified), pulls the live tag, starts containers |
| `README.md` | New sections: Run the stack locally; Containers and images; CI job list updated |
| `.gitattributes` | Forces LF line endings (your Windows checkout had CRLF, which breaks shell scripts on Linux and Prettier's check) |

## How it was verified

- `build-and-test.sh` passed end to end with Node 24: ESLint, Prettier, 20 backend + 4 frontend tests (100% line coverage), Hadolint, ShellCheck, both images built.
- Hadolint (strictest threshold), ShellCheck and actionlint: no findings.
- `docker compose up` on a fresh clone: db, backend, frontend all healthy within about 10 seconds.
- All endpoints and CRUD worked through the frontend; `/api/health/db` went 503 with the DB stopped and back to 200; data survived a backend restart.
- Containers run as uid 1000, cannot modify app files, contain no npm and no tests; they stop with exit code 0.
- Trivy 0.76.2: 0 HIGH/CRITICAL vulnerabilities in both images.
- `docker-compose.prod.yml` resolves cleanly with example values.
- `bootstrap.sh` and `resolve-tag.sh` were run with stand-in `aws`/`docker`/`dnf` commands: correct calls, correct `.env`, stops on a tampered checksum or a missing Compose parameter, rejects injected or invalid tags.

Note: in my sandbox the build needed a proxy certificate added to the base image locally. Nothing about that is in the repository; on your machine and on GitHub runners the Dockerfiles build as written.

## What you need to do yourself

1. **Commit and push under your own name** (so the contribution counts for you):
   ```bash
   git checkout -b feature/dockerfiles      # keeps the staged changes
   git status                               # 14 staged files; the 3 PDFs stay untracked, do not add them
   git commit -m "build(docker): add Dockerfiles, Compose files and container CI stages"
   git push -u origin feature/dockerfiles
   ```
   Then open a PR and request review from Muneeb (the rotation). Smaller PRs count for more, so you may split it (Dockerfiles; Compose; CI stages; scripts; rollback workflow).
   The latest repository on GitHub may be ahead of your zip. Run `git pull origin main` on main first and rebase if needed.
2. **Run it once on your own laptop** (`docker compose up --build -d`, open http://localhost:8080) and, if you want, retake screenshots 03 and 04 on your own machine.
3. **Create the ECR repositories** in AWS CloudShell (Task 4 of the guide): two repos with `--image-tag-mutability IMMUTABLE`, scan on push, plus the keep-30 lifecycle policy. Send the ARNs to Abdullah.
4. **Coordinate with teammates**:
   - Abdullah: repository variables `CI_ROLE_ARN`, `DEPLOY_ROLE_ARN`, `AWS_REGION`; stages 7 and 8. When stage 8 exists, change `build-image` to `needs: dependency-scan` (comment in `ci.yml`).
   - Ahmed: paste `deploy/bootstrap.sh` into the launch template, IMDSv2 hop limit 2, NAT; he writes `scripts/deploy.sh` and the `ASG_NAME`, `APP_URL` variables.
   - Hassaan: log groups `/devops-task-tracker/backend` and `/frontend`, CloudWatch agent config parameter, `scripts/smoke-test.sh`.
   - The rollback workflow will not run until `deploy.sh` and `smoke-test.sh` exist.
5. **Mark the new jobs as required checks** in branch protection: `5. Dockerfile lint (Hadolint)`, `9. Build images`, `10. Image scan (Trivy)`.
6. **Submission screenshots that only you can take** (they need GitHub and AWS):
   - `02-hadi-ci-stages.png`: a green run on main with every stage as a separate job.
   - `04-hadi-ecr-tags.png`: ECR image lists showing `sha-` and `v` tags plus "Immutable".
   - `10-hadi-manual-rollback.png`: a green Manual rollback run next to the page showing the older version.

## Screenshots included (local evidence)

01 build-and-test script · 02 Hadolint/ShellCheck/actionlint · 03 Compose up, all healthy · 04 app in browser · 05 health checks and API · 06 Trivy clean · 07 production Compose valid · 08 non-root and image contents · 09 graceful stop · 10 rollback tag check (stand-in aws)
