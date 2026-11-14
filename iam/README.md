# IAM policy templates

These templates are for the `devops-task-tracker` AWS resources used by this
repository. Replace every `ACCOUNT_ID`, `REGION`, and `DB_SECRET_ARN` value
before creating the policies. Do not commit credentials or secret contents.

## GitHub OIDC trust

The trust policy is intentionally restricted to the `main` branch of
`MUNEEBAZAM96/DevOps_Final_project`, using the numeric owner and repository IDs
from GitHub. The repository was created after GitHub introduced immutable
subject claims, so its default subject format should include those IDs:
`repo:OWNER@OWNER_ID/REPO@REPO_ID:ref:refs/heads/main`. No custom subject
template should be needed. If AWS rejects the trust policy, inspect the actual
OIDC subject from a workflow run and update the policy to match. The AWS account
ID is still required in the provider ARN.

Use `github-trust-policy.json` for both `devops-task-tracker-ci` and
`devops-task-tracker-deploy`. Use `ec2-trust-policy.json` for
`devops-task-tracker-ec2`.

## Permission policies

- `ci-role-policy.json`: push the two application images and write versioned
  Compose files to Parameter Store.
- `deploy-role-policy.json`: inspect project images, switch the live SSM tag,
  and refresh the named Auto Scaling group. Read-only Auto Scaling describe
  calls use `Resource: "*"` because those APIs do not support resource-level
  restrictions.
- `ec2-role-policy.json`: pull the application images, read project settings
  and the one database secret, and write to the two application log groups.

Attach the AWS managed `AmazonSSMManagedInstanceCore` and
`CloudWatchAgentServerPolicy` policies to the EC2 role as described in the
project guide. Create the EC2 instance profile and add the EC2 role to it.

Review these templates against the actual AWS resource ARNs before applying
them. RDS and the Auto Scaling group have not yet supplied their final values.
