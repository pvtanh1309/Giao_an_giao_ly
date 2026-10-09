# Terraform application infrastructure

Dev/prod roots each call the shared identity, database, app-hosting, content-api and user-api modules. Each environment has an independent Cognito pool, DynamoDB table, versioned S3 bucket, CloudFront distribution, two HTTP APIs and two Lambda functions. Bootstrap/state resources are separate.

Build Python artifacts first: `python Backend/scripts/package_lambdas.py` from repo root. Modules consume Backend/dist/content-api.zip and users-api.zip. Configure terraform.tfvars using the environment example, then init, validate and review plan in that environment.

Full steps: [deployment runbook](../Backend/docs/deployment-runbook.md). Terraform >=1.15; AWS provider ~>6.0 locked to6.67.0. Provider lock checksums retain the existing signed release hashes for Windows/Linux portability. Commit lock files; exclude .terraform, state, plans and private tfvars.

Outputs supply all IDs and endpoints for frontend integration. Exact extra frontend origins, alarm/budget emails and existing custom domain certificates are optional. App bucket versioning is required by private media pinning; CloudFront OAC reads frontend/* only. Lambda execution roles grant only their service responsibilities, with DynamoDB ListStreams as the resource-wildcard exception required by AWS.

Offline validation uses `terraform init -backend=false`, does not inspect remote state or AWS resources, and requires normal `terraform init -reconfigure` before real plan. No AWS deployment was performed by the implementation task.
