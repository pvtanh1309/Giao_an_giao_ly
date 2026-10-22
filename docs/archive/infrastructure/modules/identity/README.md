> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: infrastructure/modules/identity/README.md. Ngu?n hi?n h?nh: [CONTEXT](../../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# Identity
Creates an environment-specific Cognito User Pool, public browser client, and the exact `admin`, `editor`, `reader` groups. Existing Terraform resource addresses are preserved. Passwords require at least 8 characters, uppercase, lowercase and a number. Self-registration is disabled; administrators provision accounts through users-api. Terraform never stores user passwords.

Inputs: `environment`, `project_name`, optional `tags`, `password_minimum_length`, `access_token_hours`, `refresh_token_days`.
Outputs: `user_pool_id`, `user_pool_arn`, `app_client_id`, `issuer_url`.

The first administrator must be provisioned separately by an operator. Password-reset account recovery requires a verified email; account creation in the API suppresses automatic invitation email. Production deletion protection is enabled.
