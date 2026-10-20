# Frontend

Next.js static export, React/TypeScript, TipTap và Cognito SDK. Deploy S3/CloudFront; không có Next.js server runtime.

Đọc [CONTEXT](../docs/CONTEXT.md) trước khi code để hiểu quyền, API/DTO, editor, ghi chú cá nhân, local mock và giới hạn build-time config.

- Cài/chạy local, test/build, public env và deploy: [RUNBOOK](../docs/RUNBOOK.md).
- Persistence, font, formatting, login và CORS: [TROUBLESHOOTING](../docs/TROUBLESHOOTING.md).
- Theo dõi Frontend/API sau deploy: [MONITORING](../docs/MONITORING.md).

Source: [app](app/), [components](components/), [lib](lib/), [tests](tests/). Đọc thêm hướng dẫn Next.js đang cài trong node_modules và block AGENTS do framework sinh khi sửa framework code. Mock local chỉ phục vụ thiết kế UI; nghiệm thu persistence phải dùng API thật hoặc bộ browser regression tương ứng.
