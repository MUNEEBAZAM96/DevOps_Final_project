#!/usr/bin/env bash
# Used by the manual rollback workflow.
# Accepts either kind of image tag (sha-1a2b3c4 or v1.0.42), checks the
# image exists in ECR, and prints the matching commit tag in the form
# GitHub Actions expects:   sha_tag=sha-1a2b3c4
#
# Usage:  ./scripts/resolve-tag.sh <image-tag>
set -euo pipefail

INPUT="${1:?Usage: resolve-tag.sh <image-tag>}"

# Only accept the two tag formats the pipeline creates.
if [[ ! "$INPUT" =~ ^(sha-[0-9a-f]{7}|v[0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo "Not a valid image tag: $INPUT (expected sha-1a2b3c4 or v1.0.42)" >&2
  exit 1
fi

# Both tags point at the same image, so ask ECR for the sha- tag of that image.
# shellcheck disable=SC2016  # the backticks are JMESPath, not shell
query='imageDetails[0].imageTags[?starts_with(@, `sha-`)] | [0]'
if ! sha_tag=$(aws ecr describe-images --repository-name devops-task-tracker/backend \
  --image-ids imageTag="$INPUT" --query "$query" --output text 2>/dev/null); then
  echo "No backend image has the tag $INPUT" >&2
  exit 1
fi
if [ -z "$sha_tag" ] || [ "$sha_tag" = "None" ]; then
  echo "The image tagged $INPUT has no sha- tag" >&2
  exit 1
fi

if ! aws ecr describe-images --repository-name devops-task-tracker/frontend \
  --image-ids imageTag="$sha_tag" >/dev/null 2>&1; then
  echo "No frontend image has the tag $sha_tag" >&2
  exit 1
fi

echo "Rolling back to $sha_tag (asked for $INPUT)" >&2
echo "sha_tag=$sha_tag"
