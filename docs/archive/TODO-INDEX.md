> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: TODO-INDEX.md. Ngu?n hi?n h?nh: [CONTEXT](../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# Project implementation index

Backend và Terraform đã được điền. Bắt đầu tại [Backend README](Backend/README.md), [deployment runbook](Backend/docs/deployment-runbook.md) và [Terraform README](infrastructure/README.md).

Nguồn chuẩn là [API contract](Backend/docs/api-contract-v1.md). Có 42 route: 38 route gốc và 4 route đọc quản lý bổ sung để tiếp tục draft/restore sau reload.

## Code map

| Phần | File chính |
|---|---|
| Nội dung draft/publish/delete/restore | [content.py](Backend/content_api/services/content.py) |
| Media private/version/TTL | [media.py](Backend/content_api/services/media.py), [media lifecycle](Backend/content_api/services/media_lifecycle.py) |
| Hồ sơ | [catechists.py](Backend/users_api/services/catechists.py) |
| Cognito account | [accounts.py](Backend/users_api/services/accounts.py) |
| HTTP và quyền | [http.py](Backend/shared/http.py), [auth.py](Backend/shared/auth.py) |
| Transaction DB | [db.py](Backend/shared/db.py) |
| TipTap | [validator](Backend/shared/tiptap_validator.py) |
| Package và admin ban đầu | [scripts](Backend/scripts/package_lambdas.py), [create admin](Backend/scripts/create_admin.py) |
| Terraform | [dev](infrastructure/environments/dev/main.tf), [prod](infrastructure/environments/prod/main.tf) |

Còn công việc ngoài triển khai code backend: AWS dev plan/apply và kiểm thử thực tế, frontend Cognito/API adapters theo [integration map](Frontend/docs/backend-integration-map.md), sau đó promote prod và CI/CD deploy bằng OIDC.
