# Backend AWS

Backend Python 3.12 cho hai HTTP API: nội dung/media và danh bạ/tài khoản. Có 42 route theo [API contract](docs/api-contract-v1.md), gồm 38 route ban đầu và 4 route quản lý để đọc lại draft/thùng rác sau reload. Terraform ở [infrastructure](../infrastructure/README.md).

## Chạy kiểm thử

Từ root dự án, dùng Python 3.12:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r Backend\requirements-dev.txt
Set-Location Backend
..\.venv\Scripts\python.exe -m pytest -q
Set-Location ..
```

Trong workspace này Python đã nằm tại `.tools/python/` và môi trường `.venv/` đã được tạo. Tests chỉ dùng fake/moto; không dùng credentials AWS thật. Test conftest đặt credentials thử và tắt EC2 metadata lookup.

## Cấu trúc

- `content_api/services/content.py`: META/DRAFT/PUBLISHED, snapshot transaction đọc, CAS ghi, publish, xóa mềm/restore.
- `content_api/services/media*.py`: media ownership, kiểm tra HEAD, phiên bản S3 cố định, presign, cleanup.
- `users_api/services/`: hồ sơ độc lập, liên kết tài khoản và thao tác Cognito.
- `shared/http.py`: dispatch payload v2, validate JSON, response envelope và lỗi an toàn.
- `shared/auth.py`: verified access-token claims, group matrix, ACCOUNT hiện hành và thu hồi phiên.
- `shared/db.py`: Query/GSI và transaction; danh sách không dùng Scan.
- `shared/tiptap_validator.py`: allowlist đúng frontend, giới hạn schema/depth/200 KiB.
- `tests/`: HTTP matrix, contract, vòng đời, compensation và regression tests.

Lambda environment cần `TABLE_NAME`, `USER_POOL_ID`, `USER_POOL_CLIENT_ID`; content Lambda thêm `MEDIA_BUCKET`. Không có credentials hardcode.

## Đóng gói Lambda

```powershell
.\.venv\Scripts\python.exe Backend\scripts\package_lambdas.py
```

Script cài dependency runtime đã pin và tạo `Backend/dist/content-api.zip`, `Backend/dist/users-api.zip`. ZIP chứa package API tương ứng, shared và dependency ở root; không chứa docs/tests/state/password. Terraform mặc định đọc đúng hai đường dẫn này. Chạy lại package sau mỗi thay đổi Python; ZIP không commit.

## Tạo admin đầu tiên

Sau khi apply dev và lấy outputs, người vận hành chạy:

```powershell
.\.venv\Scripts\python.exe Backend\scripts\create_admin.py --pool-id <pool-id> --table-name <table-name> --email <admin-email> --expected-account-id <aws-account-id> --profile <aws-profile>
```

Script xác minh account, hiển thị pool/table, yêu cầu xác nhận thao tác và nhập password ẩn. Nó tạo Cognito user, group admin và record ACCOUNT. Terraform không tạo user/password. Nếu chỉ tạo user trong Console mà thiếu ACCOUNT, API sẽ từ chối tài khoản đó.

## Quy tắc vận hành

- Account DISABLED/DELETED hoặc đang pending disable/archive bị API từ chối ngay, kể cả JWT chưa hết hạn. Sau enable/restore phải đăng nhập lại; `iat` mới hơn `tokenValidAfter`.
- API không cho sửa account ADMIN; tạo/khôi phục admin do operator thực hiện. Đây là bảo vệ mạnh hơn chỉ chặn admin cuối cùng.
- Thao tác enable/disable/archive/restore giữ pendingAction cùng lease 120 giây để khôi phục khi Cognito và DB lệch trạng thái. Nếu gặp lỗi, đợi lease hết rồi retry đúng endpoint. Lambda timeout 29 giây.
- Hồ sơ và account độc lập. Xóa hồ sơ gỡ mọi liên kết trong cùng transaction, không disable account. Restore hồ sơ không tự nối lại account.
- Mỗi hồ sơ tối đa 45 account liên kết để thao tác archive còn atomic.
- Giáo án tối đa 40 ảnh khác nhau giữa draft và published. Thay quá nhiều ảnh một lần có thể vượt giới hạn transaction; chia thành nhiều lần save.
- Upload chưa gắn TTL 1 ngày; media orphan/xóa mềm TTL 10 ngày. Bytes ảnh không vào DynamoDB. PUT 5 phút, GET 15 phút; S3 versioning bắt buộc và GET gắn VersionId đã kiểm tra.
- TTL không chạy chính xác từng phút. Consumer bỏ qua event stale và báo partial failures; xem queue/alarm khi cleanup thất bại.
- Không log password/JWT/request body. Provisioning bị timeout cứng có thể cần operator đối chiếu Cognito và ACCOUNT; log chỉ có requestId/identifier phục vụ xử lý.
- Hai catalog LESSON/PROGRAM dùng partition toàn loại để hỗ trợ filter tùy chọn; Query metadata và đọc snapshot base-table trước khi trả. Dữ liệu lớn cần chiến lược phân trang/index mới.

## Triển khai và tích hợp

Đọc [runbook](docs/deployment-runbook.md). Code đã có kiểm thử offline và cấu hình Terraform được validate. Chưa có kiểm thử AWS thật hoặc frontend nối API. Frontend tiếp tục cần Cognito login, API clients, DTO adapters, upload và xử lý lỗi theo [bản đồ tích hợp](../Frontend/docs/backend-integration-map.md).
