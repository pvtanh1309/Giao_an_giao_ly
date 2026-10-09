# Backend Implementation Plan

> Cập nhật: người dùng đã yêu cầu hoàn thiện backend/Terraform. Phần code và kiểm thử offline đã triển khai theo [kế hoạch thực hiện](../../docs/superpowers/plans/2026-10-08-backend-implementation.md). Checklist bên dưới giữ lại làm lộ trình tích hợp/deploy; trạng thái hiện hành và các bước tiếp theo nằm trong [runbook](deployment-runbook.md). Chưa deploy AWS hoặc nối frontend.

**Mục tiêu:** Xây dựng backend AWS cho frontend giáo án giáo lý đã có, theo hợp đồng API đã chốt, rồi tích hợp và triển khai dev trước khi promote sang prod.

**Kiến trúc:** Hai HTTP API Gateway tách biệt (`content-api`, `users-api`), hai Lambda Python 3.12 với route dispatch thuần Python, một DynamoDB table `GiaoLyTable` cho mỗi môi trường và Cognito User Pool. Mỗi môi trường dùng một app S3 bucket cho cả static frontend lẫn ảnh inline, tách quyền bằng prefix `frontend/` và `lesson-media/`; Terraform state nằm trong bucket S3 riêng.

**Công nghệ:** Python 3.12, pytest, boto3, AWS Lambda, API Gateway HTTP API payload v2, Cognito JWT authorizer, DynamoDB on-demand, S3 presigned URLs, CloudFront OAC, Terraform.

**Tài liệu nguồn chuẩn:** [Thiết kế DB/backend](backend-database-design.md), [API Contract v1](api-contract-v1.md).

**Tài liệu AWS tham khảo:** [S3 pricing](https://aws.amazon.com/s3/pricing/), [CloudFront OAC giới hạn truy cập S3](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

## Quyết định không thay đổi

- Region `ap-southeast-1` (Singapore); dev/prod có variables, resources và Terraform state key độc lập.
- Hai API Gateway HTTP API và hai Lambda; không thêm bảng DynamoDB hoặc Lambda cho ảnh.
- Hai account/API roles: `admin`, `editor`, `reader`; chưa bật MFA.
- Mỗi môi trường chỉ có một `GiaoLyTable` On-Demand; rich text TipTap JSON được validate rồi lưu ở DynamoDB, bytes ảnh ở S3.
- Mỗi môi trường có một app bucket private: `frontend/*` dành cho CloudFront; `lesson-media/*` chỉ content-api truy cập qua presigned URL. Không dùng chung quyền giữa hai prefix.
- Bucket Terraform state tách riêng hoàn toàn khỏi app bucket; dùng versioning, mã hóa, giới hạn IAM và S3 lockfile `use_lockfile = true`; không tạo DynamoDB lock table.
- Lesson/reference draft và published giữ bản hiện hành; xóa mềm và khôi phục trong 10 ngày; chương trình học cập nhật đè bản hiện tại.
- Không cho browser AWS credentials, quyền Cognito Admin API, public S3 ACL hoặc URL ảnh ký hạn vào document bền vững.

## Trạng thái đầu vào sau khi hoàn tất frontend

UI và luồng thao tác đã có nhưng frontend vẫn dùng dữ liệu mock/in-memory, chưa nối Cognito hay API thật. Trước tích hợp cần viết adapter ranh giới API vì kiểu frontend chưa hoàn toàn giống contract:

- Các rich-text editor giữ TipTap JSON dưới dạng string trong một số field; `LessonSection.contentHtml` là tên legacy dù nội dung là JSON.
- `ProgramScheduleRow.values` là `Record<string, string>` chứa JSON TipTap dạng chuỗi; API contract cần JSON object cho từng ô.
- Frontend tạo nội dung/state local; ID lesson mới do backend sinh nên phải tạo draft trước khi xin presigned URL tải ảnh.
- Frontend hiện chưa có provider Cognito access-token thật; mock role không được dùng làm thông tin xác thực API.
- Nhập Excel với màn hình xem trước và kiểm tra lỗi đang tạm hoãn, không thuộc phạm vi API v1 và không chặn các bước triển khai Backend hiện tại. Sẽ lập kế hoạch và chốt contract riêng khi bắt đầu lại tính năng này.

Không đổi contract để khớp với kiểu tạm trong UI; adapter frontend phải chuẩn hóa JSON object lúc gửi API và serialize lại khi hydrate editor.

## Thứ tự triển khai

### Giai đoạn 0 — Đóng băng contract và công cụ học

- [ ] Đọc hai tài liệu nguồn chuẩn; lập bảng đối chiếu frontend DTO ↔ API request/response cho lesson, program, reference, catechist, account, media.
- [ ] Xác nhận từng route, enum, quyền, status/TTL, kích thước và lỗi chuẩn trước khi viết handler.
- [ ] Giữ nhập Excel với xem trước/kiểm tra lỗi ngoài phạm vi API v1 cho đến khi người dùng chủ động khởi động lại tính năng này.
- [ ] Cài/kiểm tra Python 3.12, `venv`, `pytest`, AWS CLI, Terraform; cấu hình AWS CLI profile có quyền tối thiểu (không dùng root để triển khai) và xác minh account/region bằng lệnh đọc thông tin.
- [ ] Không ghi access key, password, JWT, Terraform state hoặc dữ liệu người dùng vào Git.

**Cổng hoàn tất:** Bảng mapping và công cụ local rõ ràng; chưa phát sinh AWS resource billable.

### Giai đoạn 1 — Khởi tạo Python và kiểm thử cục bộ

- [ ] Tạo cấu trúc tối thiểu đã mô tả trong `backend-database-design.md`: `content_api/`, `users_api/`, `shared/`, `tests/unit/`, `tests/integration/`.
- [ ] Tạo handler Lambda payload v2 nhỏ nhất cho mỗi API, dispatcher theo `routeKey` (method + path), response/error shape dùng chung.
- [ ] Viết pytest trước cho route match, method/path không hỗ trợ, JSON sai định dạng, CORS preflight, request ID và response envelope; chứng kiến test đỏ rồi mới cài hành vi.
- [ ] Giữ router thuần Python, không thêm framework routing; AWS SDK gọi ở repository/service biên ngoài để unit test không cần AWS.

**Cổng hoàn tất:** `pytest` chạy offline; hai handler trả response chuẩn cho route smoke test.

### Giai đoạn 2 — Terraform state và môi trường dev nền

- [ ] Bootstrap bucket state riêng một lần; vì bucket chưa thể tự làm backend trước khi được tạo, tạo bằng console hoặc một cấu hình bootstrap tạm rồi migrate state ngay sang S3. Bật Block Public Access, encryption, versioning, IAM least privilege và `use_lockfile = true`; state key dev/prod độc lập. Không dùng local state để triển khai app dev/prod.
- [ ] Viết Terraform dev theo thứ tự dependency: placeholder Lambda → app bucket → CloudFront OAC/distribution → Cognito pool/client/groups → DynamoDB table/GSI/TTL/Stream → Lambda roles/log groups → hai HTTP API, JWT authorizer, routes/integration → outputs.
- [ ] App bucket có `frontend/` và `lesson-media/`; CloudFront S3 REST origin path là `/frontend`, OAC bucket policy chỉ `s3:GetObject` trên `frontend/*`.
- [ ] `content-api` IAM chỉ có quyền cần thiết trên DynamoDB và `lesson-media/*`; không có public access. CORS app bucket cho origin localhost dev và CloudFront prod, method/header tối thiểu; CORS không thay thế authorization.
- [ ] Chạy `terraform fmt`, `terraform validate`, đọc toàn bộ `terraform plan`; chỉ `apply` dev sau khi người dùng xem và xác nhận chi phí/resource plan.

**Cổng hoàn tất:** Dev outputs gồm API URLs, Cognito IDs, CloudFront domain, table/bucket names; không lộ secret. Prod chưa apply.

### Giai đoạn 3 — Shared HTTP, claims và authorization

- [ ] Viết `shared/responses.py`, `shared/errors.py`, `shared/auth.py`, `shared/models.py` theo handler payload v2.
- [ ] Dùng claim từ JWT đã được API Gateway authorizer xác minh; Lambda vẫn kiểm tra `cognito:groups` cho từng route. Không tin role, `createdBy`, `updatedBy` hoặc user ID do body frontend gửi.
- [ ] Unit-test reader/editor/admin matrix, thiếu claims, nhóm không hợp lệ, lỗi validation, request ID và response không rò stack trace/credential.

**Cổng hoàn tất:** Mỗi route được bảo vệ từ chối thiếu quyền ở unit test trước khi kết nối dữ liệu.

### Giai đoạn 4 — `content-api`: đọc và quản lý nội dung không gồm media trước

- [ ] Cài router và repositories DynamoDB với key schema `GiaoLyTable`; dùng Query/GSI cho catalog, không dùng Scan cho luồng danh sách.
- [ ] Implement và test các route đọc published lessons/programs/catechists/references; reader không bao giờ nhận draft/deleted content.
- [ ] Implement quản lý lesson draft/publish/delete/restore, version conflict và publish transaction; validate TipTap JSON bằng allowlist node/mark, depth và giới hạn 200 KB.
- [ ] Implement chương trình học với `scheduleColumns`, mỗi cell TipTap JSON, `mergedCellGroups`; cập nhật đè bản hiện hành theo contract.
- [ ] Implement reference categories cố định `Sinh hoạt`/`Kỹ năng` và vòng đời draft/publish/delete/restore giống contract.
- [ ] Mỗi service có unit tests trước; repository tests bằng DynamoDB Local/moto hoặc test double có thể kiểm soát, sau đó integration test với dev table.

**Cổng hoàn tất:** Contract tests chứng minh dữ liệu reader/editor/admin đúng quyền, không lộ draft, publish/version/delete/restore đúng.

### Giai đoạn 5 — Media ảnh inline trên cùng app bucket

- [ ] Thêm route cấp presigned PUT URL 5 phút và URL đọc 15 phút; backend tự tạo `mediaId`/object key trong `lesson-media/<lessonId>/<mediaId>`.
- [ ] Chỉ nhận JPEG/PNG/WebP, tối đa 5 MiB; không tin metadata browser: khi gắn media vào draft/publish, dùng `HeadObject` kiểm tra object thật, loại, kích thước và quyền thuộc lesson.
- [ ] Lưu metadata `MEDIA#<mediaId>` trong cùng GiaoLyTable, không lưu bytes/base64/signed URL; URL `src` chỉ là giá trị runtime do backend cấp theo revision và role.
- [ ] Cấu hình DynamoDB Stream `NEW_AND_OLD_IMAGES` và event mapping hiện có tới content-api cho cleanup; xử lý idempotent, retry/DLQ/alarm. Giữ users-api consumer riêng để xử lý account TTL; không tạo Lambda thứ ba.
- [ ] Kiểm tra IAM: CloudFront không thể GET `lesson-media/*`; reader không được xin URL ảnh draft; editor không gắn media của lesson khác; upload bỏ dở TTL một ngày, orphan/deleted media theo 10 ngày.

**Cổng hoàn tất:** Test presign giả lập + test tích hợp dev chứng minh upload/download hợp lệ và không truy cập trực tiếp object không được cấp phép.

### Giai đoạn 6 — `users-api`: danh bạ và cấp account

- [ ] Implement list/create/update/delete/restore hồ sơ giáo lý viên theo API contract; editor/admin được quản lý hồ sơ.
- [ ] Implement admin-only Cognito account list/create/reset password/enable/disable/archive/restore; Editor/Reader theo group, Editor liên kết profile đã tồn tại; Reader dùng chung không cần profile.
- [ ] Không lưu password vào DynamoDB/log/response; tạo profile/account có compensating action nếu Cognito và DynamoDB lệch trạng thái; bảo vệ admin cuối cùng.
- [ ] Unit-test nhóm quyền, profile-account link, email trùng, Cognito lỗi giữa chừng, retention TTL và stream delete idempotency.

**Cổng hoàn tất:** Người dùng chỉ có thể được tạo và quản lý đúng route/role; kiểm thử tích hợp Cognito + dev table qua `users-api`.

### Giai đoạn 7 — Tích hợp frontend với API dev

- [ ] Thêm content/users API clients; thay data fixtures bằng GET/load/save actions theo từng trang và dùng error envelope.
- [ ] Tích hợp Cognito login/token refresh; cung cấp `getAccessToken()` thật. UI có thể dùng claims để ẩn/hiện điều khiển, nhưng mọi quyền vẫn phải được API/Lambda xác minh.
- [ ] Viết DTO adapters cho TipTap JSON object ↔ chuỗi editor và cho schedule cells; bảo đảm bỏ `attrs.src` runtime khi save, giữ `mediaId`, `alt`, `width`, `alignment`.
- [ ] Tạo draft lesson để lấy ID backend trước khi upload ảnh; không dùng mock ID. Cấu hình API base URLs từ Terraform outputs bằng env vars, không ghi URL môi trường prod vào bundle dev.
- [ ] Kiểm thử end-to-end dev: login từng role, đọc, sửa/publish, upload/zoom ảnh, danh bạ, tạo account, hết hạn URL, reload trang và lỗi `401/403/409`.

**Cổng hoàn tất:** Có thể tạo dữ liệu qua UI dev và dữ liệu còn sau reload; reader chỉ thấy bản xuất bản.

### Giai đoạn 8 — Hardening và promote prod

- [ ] Xác nhận log không ghi password/token/payload nhạy cảm; bật retention, metric/alarm Lambda errors/throttles, API throttling và AWS Budget.
- [ ] Kiểm tra PITR production, retention TTL, backup/recovery tabletop, CORS/origin, Bucket Public Access, OAC prefix condition, IAM diff và CloudWatch trace/requestId.
- [ ] Tạo cấu hình Terraform prod bằng variables riêng và state key prod; plan prod phải khác dev chỉ ở tên/hosts/retention/secrets được chủ ý cấu hình.
- [ ] Chạy bộ test/unit, repository, payload v2 integration, contract FE↔API và smoke test prod. Đọc plan, xác nhận chi phí, rồi mới apply prod.
- [ ] Ghi lại thao tác deploy/rollback, thay đổi schema tương thích ngược, cảnh báo và runbook sự cố.

**Cổng hoàn tất:** Prod được deploy có xác nhận; quyền/backup/log/budget/rollback được kiểm tra; không có secret hoặc state trong Git.

## Điều kiện dừng trước khi tích hợp frontend

Không nối frontend prod trước khi login Cognito và API dev hoàn tất; không tạo dữ liệu thật trước khi kiểm thử phân quyền backend; không cấp URL media trước khi kiểm tra ownership/status; không `terraform apply` khi chưa đọc plan; không dùng cùng state key giữa dev/prod.
