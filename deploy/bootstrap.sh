#!/bin/bash
# EC2 user data for the application instances (Amazon Linux 2023).
# Ahmed pastes this file into the launch template. It runs once, as root,
# every time the Auto Scaling Group starts a new instance.
#
# What it does:
#   1. finds the AWS region and account
#   2. installs Docker, the Compose plugin and the CloudWatch agent
#   3. reads which image tag is live, plus that version's Compose file,
#      from SSM Parameter Store
#   4. logs in to ECR, pulls the images and starts the containers
set -euo pipefail

# The paths below can be overridden only for local testing.
APP_DIR="${APP_DIR:-/opt/devops-task-tracker}"
PLUGIN_DIR="${PLUGIN_DIR:-/usr/local/lib/docker/cli-plugins}"
CW_AGENT_CTL="${CW_AGENT_CTL:-/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl}"
LOG_FILE="${LOG_FILE:-/var/log/app-bootstrap.log}"

PARAMS=/devops-task-tracker
COMPOSE_VERSION=v5.7.1
CW_AGENT_CONFIG=AmazonCloudWatch-devops-task-tracker
METADATA=http://169.254.169.254/latest

# Keep a copy of everything this script prints, for troubleshooting.
exec > >(tee -a "$LOG_FILE") 2>&1
echo "Bootstrap started at $(date -u)"

# 1. Region and account, from the instance metadata service (IMDSv2).
TOKEN=$(curl -sf -X PUT "$METADATA/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
REGION=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" "$METADATA/meta-data/placement/region")
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
echo "Region $REGION, registry $REGISTRY"

# 2. Docker and the CloudWatch agent come from the Amazon Linux repositories.
dnf install -y docker amazon-cloudwatch-agent
systemctl enable --now docker

# 3. The Compose plugin comes from GitHub. Check its checksum before using it.
ARCH=$(uname -m)
COMPOSE_URL="https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-linux-$ARCH"
mkdir -p "$PLUGIN_DIR"
curl -fsSL "$COMPOSE_URL" -o "$PLUGIN_DIR/docker-compose"
expected=$(curl -fsSL "$COMPOSE_URL.sha256" | cut -d' ' -f1)
actual=$(sha256sum "$PLUGIN_DIR/docker-compose" | cut -d' ' -f1)
if [ "$expected" != "$actual" ]; then
  echo "Checksum of the Compose plugin does not match. Stopping."
  rm -f "$PLUGIN_DIR/docker-compose"
  exit 1
fi
chmod +x "$PLUGIN_DIR/docker-compose"

# 4. Start the CloudWatch agent with Hassaan's configuration (memory and disk metrics).
"$CW_AGENT_CTL" -a fetch-config -m ec2 -s -c "ssm:$CW_AGENT_CONFIG"

# 5. Read the live version, its Compose file and the settings.
get_param() {
  aws ssm get-parameter --region "$REGION" --name "$1" --query Parameter.Value --output text
}
IMAGE_TAG=$(get_param "$PARAMS/image-tag")
DB_HOST=$(get_param "$PARAMS/db-host")
DB_SECRET_NAME=$(get_param "$PARAMS/db-secret-name")

mkdir -p "$APP_DIR"
get_param "$PARAMS/compose/$IMAGE_TAG" > "$APP_DIR/docker-compose.yml"
cat > "$APP_DIR/.env" <<ENV
REGISTRY=$REGISTRY
IMAGE_TAG=$IMAGE_TAG
AWS_REGION=$REGION
DB_HOST=$DB_HOST
DB_SECRET_NAME=$DB_SECRET_NAME
ENV

# 6. Log in to ECR, pull the images and start the containers.
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"
cd "$APP_DIR"
docker compose pull
docker compose up -d

echo "Bootstrap finished at $(date -u): running $IMAGE_TAG"
