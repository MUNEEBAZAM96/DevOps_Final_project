#!/usr/bin/env bash
# Runs the same quality checks as the pipeline, then builds both images.
# Use it before every push so CI does not fail on something you could
# have caught on your own machine.
#
# Usage:  ./scripts/build-and-test.sh [image-tag]
#         (the tag defaults to "local")
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${1:-local}"
SERVICES=(backend frontend)

step() { printf '\n==> %s\n' "$*"; }

for service in "${SERVICES[@]}"; do
  step "Checking $service: install, lint, format, unit tests"
  (
    cd "$ROOT/services/$service"
    npm ci --no-audit --no-fund
    npm run lint
    npm run format:check
    npm test
  )
done

step "Linting the Dockerfiles"
if command -v hadolint >/dev/null 2>&1; then
  for service in "${SERVICES[@]}"; do
    hadolint "$ROOT/services/$service/Dockerfile"
  done
else
  echo "hadolint is not installed, skipping (the pipeline still runs it)"
fi

step "Checking the shell scripts"
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck "$ROOT"/scripts/*.sh "$ROOT"/deploy/*.sh
else
  echo "shellcheck is not installed, skipping (the pipeline still runs it)"
fi

for service in "${SERVICES[@]}"; do
  step "Building devops-task-tracker/$service:$TAG"
  docker build -t "devops-task-tracker/$service:$TAG" "$ROOT/services/$service"
done

step "All checks passed. Images built with tag $TAG"
docker images --filter "reference=devops-task-tracker/*:$TAG"
