# Archive tài liệu trước khi hợp nhất

Gom ngày **20/10/2026**. Đây là lịch sử thiết kế, kế hoạch và triển khai; **không dùng làm context/runbook hiện hành**. Đọc [CONTEXT](../CONTEXT.md), [RUNBOOK](../RUNBOOK.md), [TROUBLESHOOTING](../TROUBLESHOOTING.md), [MONITORING](../MONITORING.md) để làm việc.

Giữ 36 bản gốc để không mất quyết định/sự cố, kể cả các file trước đây bị Git ignore. Đường dẫn trong archive phản chiếu đường dẫn cũ từ root repository. Ba README thành phần được giữ bản cũ tại đây, còn vị trí gốc trở thành liên kết ngắn tới tài liệu chuẩn.

Mỗi bản có banner archive; phần nội dung gốc bên dưới được giữ để truy nguyên. ID/URL, số test pass, trạng thái “chưa tích hợp”, thiết kế Reader dùng chung, projection INCLUDE và các lệnh ở bản cũ có thể đã lỗi thời. Các liên kết source trong phần gốc có thể không còn khớp vị trí sau khi chuyển; dùng code map trong CONTEXT. Không sửa nội dung lịch sử để giả rằng nó luôn đúng với hiện tại.

`.rgignore` bỏ thư mục này khỏi tìm kiếm ripgrep mặc định, nhưng không loại tài liệu khỏi Git. Khi cần điều tra lịch sử, dùng `rg --no-ignore -n "tu-khoa" docs/archive` hoặc mở trực tiếp các liên kết dưới đây.

## Backend

- [README cũ](Backend/README.md)
- [API contract v1](Backend/docs/api-contract-v1.md)
- [Thiết kế database](Backend/docs/backend-database-design.md)
- [Kế hoạch Backend](Backend/docs/backend-implementation-plan.md)
- [Deployment runbook Backend](Backend/docs/deployment-runbook.md)
- [Tài khoản cá nhân và note](Backend/docs/personal-accounts.md)
- [README tests unit](Backend/tests/unit/README.md)
- [README tests integration](Backend/tests/integration/README.md)

## Frontend

- [README cũ](Frontend/README.md)
- [Bản đồ tích hợp API](Frontend/docs/backend-integration-map.md)
- [Spec trang đọc](Frontend/docs/superpowers/specs/2026-10-06-lesson-program-reading-pages-design.md)
- [Spec thư viện và ảnh](Frontend/docs/superpowers/specs/2026-10-06-reference-library-lesson-images-design.md)
- [Plan thư viện và ảnh](Frontend/docs/superpowers/plans/2026-10-06-reference-library-lesson-images.md)
- [README browser tests](Frontend/tests/browser/README.md)

## Infrastructure

- [README cũ](infrastructure/README.md)
- [Runbook CI/CD cũ và lịch sử lỗi IAM](infrastructure/RUNBOOK-CICD.md)
- [Runbook destroy/rebuild Dev](infrastructure/environments/dev/DEV-RUNBOOK.md)
- [Ghi chú IAM diagnosis](infrastructure/iam/README.md)
- [Module hosting](infrastructure/modules/app-hosting/README.md)
- [Module content](infrastructure/modules/content-api/README.md)
- [Module database](infrastructure/modules/database/README.md)
- [Module identity](infrastructure/modules/identity/README.md)
- [Module users](infrastructure/modules/user-api/README.md)

## Kế hoạch và ledger root

- [TODO index cũ](TODO-INDEX.md)
- [Scaffold spec](docs/superpowers/specs/2026-10-07-project-todo-scaffold-design.md)
- [Scaffold plan](docs/superpowers/plans/2026-10-07-project-todo-scaffold.md)
- [Scaffold progress](docs/superpowers/plans/2026-10-07-project-todo-scaffold-progress.md)
- [Backend implementation plan](docs/superpowers/plans/2026-10-08-backend-implementation.md)
- [Frontend integration spec](docs/superpowers/specs/2026-10-10-frontend-integration-foundation-design.md)
- [Frontend integration plan](docs/superpowers/plans/2026-10-10-frontend-integration-foundation.md)
- [CI/CD integration plan](docs/superpowers/plans/2026-10-13-cicd-integration.md)
- [Personal profile/note spec](docs/superpowers/specs/2026-10-17-personal-profiles-and-lesson-notes-design.md)
- [Personal profile/note plan](docs/superpowers/plans/2026-10-17-personal-profiles-and-lesson-notes.md)
- [Personal profile/note ledger](docs/superpowers/plans/personal-profiles-ledger.md)
- [Dark mode spec](docs/superpowers/specs/2026-10-18-dark-mode-design.md)
- [Dark mode plan](docs/superpowers/plans/2026-10-18-dark-mode.md)
