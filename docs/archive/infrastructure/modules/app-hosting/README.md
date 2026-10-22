> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: infrastructure/modules/app-hosting/README.md. Ngu?n hi?n h?nh: [CONTEXT](../../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# App hosting
One private, encrypted, versioned app S3 bucket per environment. CloudFront uses OAC and a REST origin rooted at `/frontend`; its bucket policy permits only `frontend/*`. Media stays under `lesson-media/*` and is accessed through short-lived Lambda-signed URLs. Public access and ACLs are disabled.

Inputs: `environment`, `project_name`, `tags`, additional `frontend_allowed_origins`, optional `domain_name`, existing `certificate_arn` in us-east-1 and `hosted_zone_id`.
Outputs: bucket name/ARN, CloudFront domain/distribution ID, `frontend_url`.

Deploy static Next.js exports to `frontend/`. The viewer-request function maps extensionless routes to `.html` and slash paths to `index.html`; it does not turn missing/private objects into a public fallback. Bucket CORS automatically includes the generated CloudFront/custom origin. Versioning preserves media version IDs after upload; media cleanup explicitly removes versions. No automatic noncurrent-version expiration is configured because published documents may reference older versions. Only incomplete multipart media uploads expire after one day.
