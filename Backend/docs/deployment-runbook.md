# Backend deployment runbook

## 1. Local verification and packaging

Use Python 3.12 and Terraform >=1.15. Install Backend/requirements-dev.txt in a virtual environment, then run `python -m pytest -q` from Backend. From repo root run `python Backend/scripts/package_lambdas.py`.

Artifacts: Backend/dist/content-api.zip and users-api.zip. Rebuild after modifying any API/shared Python code. Runtime dependencies are pure Python and pinned; no Windows compiled dependencies belong in Lambda ZIPs.

## 2. AWS identity and environment

Use an operator IAM profile, verify `aws sts get-caller-identity --profile <profile>`, and confirm account/region. Configure AWS_PROFILE only locally. Backend state keys remain:

- bootstrap: giaoan-web/bootstrap/terraform.tfstate
- dev: giaoan-web/dev/terraform.tfstate
- prod: giaoan-web/prod/terraform.tfstate

State bucket is gxthaian-giaoan-web-2026, separate from each app bucket. Ensure the old misplaced bootstrap state object at the dev key has been resolved before initializing dev; do not deploy dev against bootstrap resources. This task did not inspect or mutate remote state.

Copy the environment's terraform.tfvars.example to terraform.tfvars and review existing values. CloudFront origin is included automatically; add exact localhost origin only for dev testing. Custom domains are optional: provide an existing frontend ACM certificate in us-east-1, API certificate in ap-southeast-1, and optional existing Route53 hosted zone. Default CloudFront/API AWS hostnames work without custom DNS.

## 3. Dev plan and deployment

From infrastructure/environments/dev:

```powershell
terraform init -reconfigure
terraform fmt -check -recursive
terraform validate
terraform plan -out=dev.tfplan
```

The implementation was validated locally with `init -backend=false` and a cached AWS provider; normal init above is needed to configure the real S3 backend. Review all resource creations/replacements and cost settings. Then run `terraform apply dev.tfplan` yourself when ready. No apply was run during implementation.

Outputs expose frontend URL, Cognito pool/client/issuer, two API endpoints, table and app bucket, distribution ID, alarm topic and failure queues. Confirm any SNS email subscription. Enable a budget with budget_email; activate AWS cost allocation tag Environment for tag-scoped budget attribution.

## 4. Initial admin and application access

Run Backend/scripts/create_admin.py as described in Backend/README.md. It prompts for password and creates Cognito plus ACCOUNT together. Validate that the chosen user pool/table belong to the outputs for the same environment.

Frontend authenticates Cognito directly with the public client (no client secret), obtains access token via USER_PASSWORD_AUTH and passes `Authorization: Bearer <access-token>` to the right API. Use access tokens, not ID tokens; API routes require the aws.cognito.signin.user.admin token scope and Lambda checks token_use, client_id, group and current ACCOUNT.

Bootstrap a reader and an editor through /admin/accounts. Create a catechist profile before the editor account. Keep passwords in memory only. Verify frontend DTOs send TipTap objects, not strings/HTML, and remove runtime image attrs.src before saving.

## 5. Dev acceptance checks

- Unauthenticated calls receive401; reader cannot use /manage or /admin; editor cannot use /admin.
- Create draft, reload via management list/detail, save/publish with version, and confirm reader sees only PUBLISHED. A stale version receives409.
- Archive/restore from management lists using includeDeleted=true; reader sees no archived metadata.
- Create a lesson before requesting upload URL. PUT JPEG/PNG/WebP <=5MiB with required Content-Type. Save draft, publish, read signed GET. Uploading again using an old PUT URL must not alter the pinned published version.
- A media object owned by a different lesson cannot be attached. CloudFront access to /lesson-media/... cannot read the private media prefix.
- Disable/archive an editor, reuse its prior JWT, and confirm API rejects immediately. Enable/restore, sign in again and verify old tokens remain invalid.
- Archive a linked catechist; account remains ACTIVE but catechistId is removed. Restore profile and relink explicitly.
- Inspect CloudWatch, stream IteratorAge and failure queues without logging JWT/password/request bodies. TTL deletion runs asynchronously; consumer REMOVE events safely delete external media/Cognito only after retention.

## 6. Recovery and rollback

API deployment rollback: rebuild the known-good revision's ZIPs, plan and apply that code change. Schema remains backward compatible; no migration wipes existing data.

For pending account operation, retry the same endpoint after the120-second lease. Opposing actions return409. If provisioning was terminated or both compensation and DB lookup failed, inspect the logged username/requestId, Cognito user and ACCOUNT before recreating. Never infer that missing HTTP response means no commit.

SQS stream failure destinations contain shard/sequence metadata; original stream data expires after24hours. Investigate promptly, inspect current records and referenced media before replaying cleanup. Recovery from DynamoDB PITR restores DB only, not Cognito/S3 external resources. S3 versioning preserves pinned media versions until explicit cleanup; no automatic noncurrent-media expiration is enabled.

## 7. Prod promotion

Rebuild tested artifacts, repeat init/validate/plan under infrastructure/environments/prod, review names, account, CORS, logs, certificates and notifications. Prod enables DynamoDB PITR/deletion protection and Cognito deletion protection. Apply prod only after dev acceptance checks. Frontend deployment/integration and CI/CD promotion are separate remaining steps.
