# TODO(FE): bản đồ nối frontend với backend

Đọc [API Contract v1](../../Backend/docs/api-contract-v1.md) và [TODO index](../../TODO-INDEX.md).
Đây là hướng dẫn cho bước tích hợp sau; UI hiện vẫn dùng mock/in-memory.

| TODO | File hiện có để bắt đầu | Phần cần điền |
|---|---|---|
| FE-AUTH | [site-header](../components/site-header.tsx) | Tìm state login/mock role; tạo adapter Cognito public client và getAccessToken; không nhúng secret |
| FE-CLIENT | [content-data](../lib/content-data.ts) | Tạo client API riêng cho content/users; Authorization Bearer access token; requestId/error envelope |
| FE-LESSON | [lesson-directory](../components/lesson-directory.tsx), [lesson-content](../lib/lesson-content.ts) | GET list/detail, create draft lấy backend ID, version khi save/publish; JSON object thay chuỗi editor |
| FE-PROGRAM | [program-directory](../components/program-directory.tsx), [schedule-content](../lib/program-schedule-content.ts) | Adapter schedule cells thành TipTap object; giữ columns/mergedCellGroups/version |
| FE-REFERENCE | [reference-directory](../components/reference-directory.tsx), [reference-content](../lib/reference-content.ts) | category Sinh hoạt/Kỹ năng; reader chỉ published, editor/admin draft/archive/restore |
| FE-PROFILE | [catechist-directory](../components/catechist-directory.tsx) | users-api cho profile, ID backend độc lập Cognito sub |
| FE-ACCOUNT | [system-account-directory](../components/system-account-directory.tsx) | admin-only account APIs; EDITOR link profile có sẵn; password xóa khỏi UI state sau submit |
| FE-MEDIA | [lesson-media](../lib/lesson-media.ts), [rich-text-extensions](../components/rich-text-extensions.ts) | draft ID trước presign PUT; mediaId bền vững; attrs.src runtime GET URL, bỏ src khi save |
| FE-ERROR | [lesson-dialogs](../components/lesson-dialogs.tsx), các directory trên | 401 login/refresh theo session, 403 quyền, 409 reload/conflict, URL media hết hạn |

TODO(FE-CONFIG): environment config gồm region, pool ID, public client ID, content/users base URLs; tách dev/prod.
Chưa đổi file đang chạy trong scaffold. Khi viết code Next.js, đọc Frontend/AGENTS.md và docs của phiên bản Next cài trong repo.

TODO(FE-DEPLOY): kiểm tra static export, build artifact vào frontend/ của app bucket đúng môi trường;
CloudFront origin /frontend và OAC chỉ frontend/*; media dùng presigned URL riêng.
TODO(FE-E2E): kiểm tra login ba roles, reload persistence, 401/403/409, upload và URL hết hạn trên dev trước prod.
