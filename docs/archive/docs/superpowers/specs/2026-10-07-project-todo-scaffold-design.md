> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: docs/superpowers/specs/2026-10-07-project-todo-scaffold-design.md. Ngu?n hi?n h?nh: [CONTEXT](../../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# Project TODO scaffold design

## Intent and scope

Prepare a navigable scaffold for the giaoan-web AWS application so the owner can implement each feature by finding a clearly marked `TODO`. The existing frontend remains functional. The owner will write the implementation behind each scaffold entry. This work creates no AWS resources and does not run `terraform apply`.

The authoritative contracts are `Backend/docs/api-contract-v1.md`, `Backend/docs/backend-database-design.md` (excluding its explicitly historical route section), and `Backend/docs/backend-implementation-plan.md`.

## Existing work to preserve

- Preserve `infrastructure/bootstrap/`, its S3 backend configuration, and the three distinct bootstrap/dev/prod state keys. Do not read, copy, edit, or remove state or credentials.
- Preserve the partial `infrastructure/modules/identity/main.tf`; scaffold around it without completing Cognito behavior on the owner's behalf.
- Preserve all existing frontend pages, components, and fixtures. Add only an integration map for later API work.

## Terraform scaffold

Use shared modules under `infrastructure/modules/identity`, `database`, `app-hosting`, `content-api`, and `user-api`. Each module documents its required inputs, intended resources, and outputs. Empty or unfinished modules contain comments and documentation only; they must not declare placeholder AWS resources or expose fake outputs. Existing Cognito resources stay intact. `dev` and `prod` root modules document where module calls will be added, with environment-specific values provided by each root rather than hardcoded in shared modules. Preserve separate S3 state keys and region `ap-southeast-1`.

Terraform tasks cover one User Pool/client and groups per environment; one DynamoDB table; one private app S3 bucket with `frontend/` and `lesson-media/` access boundaries; CloudFront OAC; two Lambda functions; two HTTP APIs, JWT authorizers, integrations and routes; IAM, logs, and outputs. Module call sites for incomplete modules remain commented so a plan cannot silently create partial application resources.

## Python backend scaffold

Add `Backend/content_api/`, `Backend/users_api/`, `Backend/shared/`, `Backend/tests/unit/`, and `Backend/tests/integration/`. Route maps mirror API Contract v1. Keep handlers and shared response/auth interfaces small. Unimplemented actions raise `NotImplementedError` or use explicit TODO comments; they must never claim successful persistence or authorization. Repositories isolate DynamoDB, Cognito, and S3 calls for later testing. No credentials, user data, or deployed configuration are included.

## Frontend integration map

Add documentation showing where the existing frontend will obtain an access token, call content/users APIs, map TipTap JSON and schedule cells, and handle media IDs and presigned URLs. Do not change current UI behavior or mock data in this scaffold.

## TODO index and safety

Add a root `TODO-INDEX.md` linking each capability to its exact file and to the contract section. The index gives an order: state and identity; local Python HTTP/auth; database and app hosting; API integrations; content and users features; media; frontend integration; dev verification and prod promotion. Mark deployable versus incomplete areas explicitly. Do not create example passwords, Terraform state, real AWS users, or application resources.

## Verification

Verify every index path exists; inspect new files for unresolved imports or syntax errors where tools are available; run offline Python tests and Terraform formatting/validation only where the scaffold is intended to be executable. Confirm no AWS `apply` was run and no existing frontend behavior changed. The scaffold is complete when the owner can find each agreed feature from the index and identify what code to write next without guessing which file owns it.
