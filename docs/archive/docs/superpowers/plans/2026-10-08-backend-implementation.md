> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: docs/superpowers/plans/2026-10-08-backend-implementation.md. Ngu?n hi?n h?nh: [CONTEXT](../../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# Backend and Terraform Implementation Plan

Goal: implement the existing API v1 contract and deployable dev/prod infrastructure.

Spec: Backend/docs/api-contract-v1.md and backend-database-design.md (API contract wins conflicts).

- [x] Shared request/auth/error/validation and DynamoDB transaction utilities.
- [x] Content revisions, publishing, deletion/restoration, private media lifecycle.
- [x] Catechist and Cognito account lifecycle, authorization and compensation.
- [x] Identity, database, hosting, two APIs/Lambdas, stream consumers, monitoring and environment wiring.
- [x] Offline tests, packaging/deployment documentation and independent review.

Constraints: Python 3.12; ap-southeast-1; separate environment state; no live deployment; preserve bootstrap/state; no passwords in storage/logs; no scan-based lists; no public media.

Review focus: concurrent revisions and restores; stale stream events; draft metadata leakage; media ownership; partial Cognito failures.

Rulings: implement in the existing dirty workspace to preserve the user's in-progress files; no automatic commits. User has authorized complete implementation, so proceed without another plan approval. Optional custom domains require caller-provided domain/certificate settings; default AWS URLs must work.

Execution ledger (2026-10-09): shared/content/users/infra complete. Original38 API routes plus4 management reads for reload/trash recovery; contract, Terraform and role matrix updated together. Metadata remains in GSI for management visibility, public lists recheck current status. Generic content catalog partitions support optional filters without Scan. Limits:40 media references,45 accounts/profile,120-second pending lifecycle lease,29-second Lambda timeout. ADMIN mutations intentionally operator-only. Actual AWS deployment and frontend integration remain outside this code completion.

Independent review identified atomic snapshot and revoked-token gaps; fixed with TransactGetItems and current ACCOUNT/token issuance checks. Red regression tests confirmed snapshot and presigning findings before fixes. Corrected malformed TipTap attribute types and added recovery routes;219 offline tests pass including real SDK/moto DB/S3/Cognito roundtrips. Dev/prod validate pass with Terraform1.16.5/AWS6.67.0 and no deprecation warnings. Lambda ZIPs generated; final artifact checks follow packaging. No apply or remote-state changes.
