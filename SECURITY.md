# Security

## Reporting a problem

Tell the group lead or use a private security advisory in the repository's
Security tab. Never include a token, password, or other secret in an issue or
pull request.

## How the project is protected

- Gitleaks scans the full Git history in the CI pipeline.
- SonarCloud checks source code and waits for its quality gate.
- Snyk checks npm dependencies for high and critical vulnerabilities.
- Trivy checks the built container images for high and critical vulnerabilities.
- GitHub Actions uses OIDC for AWS access; no long-lived AWS keys belong in
  the repository or GitHub secrets.
- The application reads its database credentials from AWS Secrets Manager
  through the EC2 instance role.
- In AWS, instances should accept application traffic from the load balancer
  only. SSH access should remain closed; use Session Manager.

## Coverage decisions

`services/backend/src/server.js` and `services/frontend/public/**` are excluded
from coverage calculations because they are startup and browser code. They
remain included in source analysis for bugs and security issues.

## Accepted findings

No scanner findings have been accepted yet. Record each accepted finding here
with its decision, reason, and review date after the first scans run.
