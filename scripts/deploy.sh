#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:?Usage: deploy.sh <sha-image-tag>}"
AWS_REGION="${AWS_REGION:?AWS_REGION must be set}"
ASG_NAME="${ASG_NAME:?ASG_NAME must be set}"
TIMEOUT_SECONDS="${INSTANCE_REFRESH_TIMEOUT_SECONDS:-1800}"

if [[ ! "$IMAGE_TAG" =~ ^sha-[0-9a-f]{7}$ ]]; then
  echo "Not a valid image tag: $IMAGE_TAG (expected sha-1a2b3c4)" >&2
  exit 1
fi

if ! [[ "$TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || [ "$TIMEOUT_SECONDS" -lt 1 ]; then
  echo "INSTANCE_REFRESH_TIMEOUT_SECONDS must be a positive integer" >&2
  exit 1
fi

aws ssm put-parameter \
  --region "$AWS_REGION" \
  --name /devops-task-tracker/image-tag \
  --type String \
  --value "$IMAGE_TAG" \
  --overwrite

REFRESH_ID=$(
  aws autoscaling start-instance-refresh \
    --region "$AWS_REGION" \
    --auto-scaling-group-name "$ASG_NAME" \
    --preferences MinHealthyPercentage=100 \
    --query InstanceRefreshId \
    --output text
)

if [ -z "$REFRESH_ID" ] || [ "$REFRESH_ID" = "None" ]; then
  echo "AWS did not return an instance refresh ID" >&2
  exit 1
fi

deadline=$((SECONDS + TIMEOUT_SECONDS))
while [ "$SECONDS" -lt "$deadline" ]; do
  status=$(
    aws autoscaling describe-instance-refreshes \
      --region "$AWS_REGION" \
      --auto-scaling-group-name "$ASG_NAME" \
      --instance-refresh-ids "$REFRESH_ID" \
      --query 'InstanceRefreshes[0].Status' \
      --output text
  )

  case "$status" in
    Successful)
      echo "Deployment of $IMAGE_TAG completed with refresh $REFRESH_ID"
      exit 0
      ;;
    Failed|Cancelled|RollbackFailed|RollbackSuccessful)
      echo "Instance refresh $REFRESH_ID ended with status $status" >&2
      exit 1
      ;;
    *)
      sleep 15
      ;;
  esac
done

echo "Instance refresh $REFRESH_ID did not complete within ${TIMEOUT_SECONDS}s" >&2
exit 1
