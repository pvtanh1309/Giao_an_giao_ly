# Tách Lambda nội dung theo miền chức năng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách 32 Content API route thành `lessons-api` (14 route) và `catalog-api` (18 route), giữ nguyên `users-api` cùng toàn bộ hợp đồng HTTP và dữ liệu.

**Architecture:** Giữ nguyên Content HTTP API, Cognito JWT authorizer, endpoint, CORS và route paths; chuyển integration của từng route tới Lambda theo miền. Lessons sở hữu lesson, private notes, lesson media và stream cleanup `MEDIA#`; Catalog sở hữu programs và references. Tạo hai Lambda có IAM, cấu hình, log và alarm riêng; Users API không đổi. Đo baseline Dev trước khi sửa, rồi so sánh cùng workload sau khi triển khai.

**Tech Stack:** Python 3.12, pytest, AWS Lambda, API Gateway HTTP API, DynamoDB Streams, SQS, Terraform, GitHub Actions.

**Spec:** [2026-10-20-content-lambda-domain-split-design.md](../specs/2026-10-20-content-lambda-domain-split-design.md)

## Global Constraints

- Giữ nguyên 32 route Content, 16 route Users, HTTP method/path, JWT authorizer, authorization groups, request/response envelope, CORS và public API endpoint.
- Giữ nguyên ACCOUNT check, quyền reader/editor/admin, ownership note theo Cognito `sub`, version/transaction, draft/published và media private.
- Chỉ `lessons-api` xử lý DynamoDB Stream `MEDIA#`; `users-api` tiếp tục xử lý `ACCOUNT#`; `catalog-api` không có stream mapping.
- Giữ batch size 10, batching window 1 giây, retry 10 lần, record age 86400 giây, bisect, partial batch response, SQS failure destination/retention và alarms của media cleanup.
- Không đổi DynamoDB schema/data, Cognito, S3 bucket, API ID/domain/stage, Users API hoặc Frontend API URL/config.
- Artifact cuối cùng gồm `lessons-api.zip`, `catalog-api.zip` và `users-api.zip`; manifest xác minh SHA-256 và source SHA.
- Không ghi cam kết latency trước/sau nếu số đo cùng workload chưa chứng minh; không thay đổi memory/dependency trong lần so sánh đầu.
- Kiểm tra Git diff và chỉ stage file thuộc task; giữ nguyên thay đổi có sẵn ngoài phạm vi, không dùng `git add -A`.
- Terraform plan và mọi thao tác AWS phải theo đúng môi trường; dừng trước `apply` nếu chưa có chấp thuận rõ ràng cho môi trường đó.
- Không dùng credentials thật trong kiểm tra offline; không ghi token, password, Terraform state hoặc tfvars riêng vào artifact/log/Git.

## Review Focus

- Route key bị bỏ sót hoặc nằm trong cả hai Lambda phải bị từ chối bởi `test_route_partition_is_disjoint_and_complete` (Task 2).
- Catalog nhận nhầm DynamoDB Stream event không được ack hoặc bỏ qua im lặng; kiểm tra bằng `test_catalog_handler_rejects_stream_event` (Task 2).
- Media stream batch có record lỗi phải giữ semantics retry/partial response hiện tại; kiểm tra bằng `test_lessons_handler_preserves_stream_partial_failures` (Task 2).
- Tách handler không được làm lộ note giữa accounts hoặc cho phép note với lesson chưa publish; kiểm tra bằng `test_private_crud_idempotency_and_no_lesson_mutation` và `test_disabled_and_unpublished_notes_blocked` (Task 2).
- IAM của Catalog không được có quyền S3/Streams/SQS; IAM của Lessons chỉ truy cập media prefix và failure queue cần thiết; kiểm tra bằng `Backend/tests/test_routes.py::test_lambda_policy_scope_by_domain` (Task 4).

---

### Task 1: Ghi baseline Dev trước khi thay đổi

**Files:**
- Modify: `docs/MONITORING.md`

**Interfaces:**
- Consumes: Dev release SHA, hai ZIP hiện hành, cấu hình runtime/memory, CloudWatch metrics/logs và thao tác trên Frontend.
- Produces: baseline có timestamp, workload, số liệu cold/warm và thông tin artifact để Task 6 so sánh.

- [ ] **Step 1: Chạy workload baseline trên Dev** cho list/detail lesson, đọc note, list/detail program và list/detail reference; ghi route, release SHA, thời điểm, số item/response size và điều kiện gọi.
- [ ] **Step 2: Thu số liệu Lambda/API/browser**: `Init Duration`, duration p50/p95, invocation có INIT, API Gateway latency/integration latency, browser Network duration, errors/throttles và IteratorAge nếu có.
- [ ] **Step 3: Ghi checksum, ZIP size, runtime, memory và concurrency** cùng baseline trong mục theo dõi content Lambda tại `docs/MONITORING.md`; phân biệt cold với cold và warm với warm.
- [ ] **Step 4: Rà lại ghi nhận** để bảo đảm có comparator cho cả hai miền sau khi tách; nếu baseline chưa đủ thì bổ sung trước khi sang Task 2.
- [ ] **Step 5: Commit riêng** chỉ `docs/MONITORING.md`.

### Task 2: Tách route registry và handler theo miền

**Files:**
- Create: `Backend/lessons_api/__init__.py`
- Create: `Backend/lessons_api/handler.py`
- Create: `Backend/lessons_api/routes.py`
- Create: `Backend/catalog_api/__init__.py`
- Create: `Backend/catalog_api/handler.py`
- Create: `Backend/catalog_api/routes.py`
- Modify: `Backend/shared/http.py`
- Delete: `Backend/content_api/handler.py`
- Modify: `Backend/tests/test_routes.py`
- Modify: `Backend/tests/test_content.py`
- Test: `Backend/tests/test_lesson_notes.py`

**Interfaces:**
- Consumes: `content_api.routes.ROUTES`, mỗi entry có dạng `route_key -> (service_target, allowed_groups)`.
- Produces: `lessons_api.routes.ROUTES` gồm service target thuộc `content_api.services.lessons`, `lesson_notes`, `media`; `catalog_api.routes.ROUTES` gồm target thuộc `programs`, `references`.
- Produces: `lessons_api.handler.lambda_handler(event, context)` và `catalog_api.handler.lambda_handler(event, context)`.
- Produces: `shared.http.handle(event, context, routes, stream_handler=None)`; nếu event có `Records` mà không có stream handler thì raise lỗi rõ ràng, không trả thành công giả.

- [x] **Step 1: Viết test route ownership** xác nhận Lessons có 14 route, Catalog 18 route, hai tập không giao nhau và hợp lại đúng 32 route Content cùng contract trong `docs/CONTEXT.md`.
- [x] **Step 2: Chạy test mới**: `Push-Location Backend; python -m pytest tests/test_routes.py -q; Pop-Location`. Xác nhận test ownership thất bại vì hai registry chưa tồn tại.
- [x] **Step 3: Tạo hai route registry** bằng cách phân nhóm theo service target như Interfaces; không chép hoặc sửa target, group, method/path của route.
- [x] **Step 4: Viết test handler** cho dispatch route theo registry, catalog từ chối stream, và lessons gọi media stream handler theo kiểu lazy import; test stream giữ cấu trúc partial batch response hiện tại.
- [x] **Step 5: Cập nhật shared HTTP boundary và tạo hai entry point** theo Interfaces. Chỉ import `content_api.services.media.handle_stream` bên trong callback stream của Lessons; không import media handler khi Lambda khởi tạo hoặc xử lý HTTP.
- [x] **Step 6: Chuyển test dispatch hiện tại sang entry point/domain registry mới**; giữ nguyên ma trận role và kiểm tra API envelope.
- [x] **Step 7: Chạy kiểm tra Backend**: `Push-Location Backend; python -m pytest -q; Pop-Location`. Kết quả mong đợi: PASS, gồm `test_route_partition_is_disjoint_and_complete`, `test_catalog_handler_rejects_stream_event`, `test_lessons_handler_preserves_stream_partial_failures`, `test_private_crud_idempotency_and_no_lesson_mutation` và `test_disabled_and_unpublished_notes_blocked`.
- [x] **Step 8: Commit riêng** các file Backend thuộc task.

### Task 3: Đóng gói artifact và nối CI/CD

**Files:**
- Modify: `Backend/scripts/package_lambdas.py`
- Modify: `scripts/ci/create_release_manifest.py`
- Modify: `.github/workflows/ci-backend.yml`
- Modify: `.github/workflows/cd-dev.yml`
- Create: `Backend/tests/test_package_lambdas.py`

**Interfaces:**
- Consumes: `lessons_api.handler.lambda_handler`, `catalog_api.handler.lambda_handler`, `users_api.handler.lambda_handler`.
- Produces: `Backend/dist/lessons-api.zip`, `Backend/dist/catalog-api.zip`, `Backend/dist/users-api.zip` và manifest có đúng ba artifact, SHA-256 từng ZIP và source SHA.
- Package Lessons gồm `lessons_api`, `shared`, `content_api/routes.py` và các service/repository/validator `content`, `lessons`, `lesson_notes`, `note_anchors`, `media`; Package Catalog gồm `catalog_api`, `shared`, `content_api/routes.py` và service/repository/validator `content`, `programs`, `references`. Mỗi ZIP chỉ chứa các file Python cần cho nhóm này; không đưa service domain còn lại vào chỉ vì chung thư mục.

- [x] **Step 1: Viết `test_package_artifacts_and_manifest_match_release`** kiểm tra ba tên ZIP chính xác, entry point/module domain cần có, module domain không liên quan bị loại, manifest checksum khớp bytes ZIP và source SHA được giữ.
- [x] **Step 2: Chạy test mới**: `Push-Location Backend; python -m pytest tests/test_package_lambdas.py::test_package_artifacts_and_manifest_match_release -q; Pop-Location`. Xác nhận thất bại do packager/manifest vẫn tạo hai artifact.
- [x] **Step 3: Cập nhật packager** để dựng ba ZIP tái lập từ dependency pin hiện tại và source allowlist theo miền; giữ nguyên ZIP Users.
- [x] **Step 4: Cập nhật manifest và CI** để build, kiểm tra đủ ba artifact và lưu manifest cùng release; fail job nếu ZIP thiếu hoặc checksum/source SHA không khớp.
- [x] **Step 5: Cập nhật CD** để xác minh ba artifact trước Terraform và truyền đúng ZIP path vào từng environment; không đổi Frontend build config hay thứ tự release hiện tại.
- [x] **Step 6: Chạy package/manifest tests và kiểm tra CI workflow tĩnh** bằng các lệnh project hiện có; xác nhận artifact cuối chỉ có ba ZIP trên.
- [x] **Step 7: Commit riêng** script, workflow và test thuộc task.

### Task 4: Tạo hai module Lambda và chuyển API/stream Terraform

**Files:**
- Create: `infrastructure/modules/lessons-api/main.tf`, `policy.tf`, `outputs.tf`, `variables.tf`
- Create: `infrastructure/modules/catalog-api/main.tf`, `policy.tf`, `outputs.tf`, `variables.tf`
- Modify: `infrastructure/modules/content-api/main.tf`, `policy.tf`, `outputs.tf`, `variables.tf`
- Modify: `infrastructure/environments/dev/main.tf`, `variables.tf`, `outputs.tf`
- Modify: `infrastructure/environments/prod/main.tf`, `variables.tf`, `outputs.tf`
- Modify: `infrastructure/iam/cd-dev-policy.json` và policy bổ sung nếu resource mới yêu cầu
- Modify: `Backend/tests/test_routes.py`

**Interfaces:**
- Lessons module consumes ZIP path, table name/ARN, stream ARN, app bucket ARN/name, Cognito pool/client, alarm topic, tags và log retention; produces Lambda ARN/name và queue URL.
- Catalog module consumes ZIP path, table name/ARN, Cognito pool/client, alarm topic, tags và log retention; produces Lambda ARN/name.
- Content API module consumes Lessons/Catalog Lambda ARNs và tạo integration riêng cho từng nhóm route; giữ output `content_api_endpoint`.
- Environment outputs giữ `content_stream_failure_queue_url` làm alias tương thích và thêm `lessons_stream_failure_queue_url`.

- [ ] **Step 1: Viết `test_terraform_routes_match_python_registry` và `test_lambda_policy_scope_by_domain` trong `Backend/tests/test_routes.py`**. Kiểm tra hai integration có đúng route set 14/18; Catalog policy không có S3/Streams/SQS actions; Lessons policy chỉ cho media prefix, Stream read và failure queue actions đã duyệt.
- [ ] **Step 2: Chạy hai test mới** và xác nhận thất bại với cấu hình Terraform còn một Lambda/integration và chưa có hai policy domain.
- [ ] **Step 3: Tạo Lessons Lambda module** với handler `lessons_api.handler.lambda_handler`, log group, Errors/Throttles/IteratorAge alarms, IAM theo lesson/note/media, S3 giới hạn `lesson-media/*`, Stream read và `sqs:SendMessage` tới queue.
- [ ] **Step 4: Tạo Catalog Lambda module** với handler `catalog_api.handler.lambda_handler`, log group, Errors/Throttles alarms và IAM chỉ cho DynamoDB actions/index cùng CloudWatch Logs; không có S3, Stream hoặc SQS actions.
- [ ] **Step 5: Cập nhật Content API module** để tạo hai Lambda integrations, Lambda invoke permissions riêng và gán route key đúng domain; giữ nguyên API, authorizer, stage, CORS, access logs, domain, DNS và public endpoint.
- [ ] **Step 6: Chuyển MEDIA stream mapping sang Lessons** với filter `REMOVE MEDIA#` và giữ nguyên batch/retry/age/bisect/partial response/failure destination. Giữ ACCOUNT mapping Users không đổi.
- [ ] **Step 7: Bảo toàn queue/state và log lịch sử**: dùng `moved` block cho SQS failure queue, queue alarm và stream mapping nếu địa chỉ đổi; giữ physical queue name/message retention. Dùng `moved` block để giữ CloudWatch log group cũ dưới tên legacy đến hết retention window. Không để hai MEDIA consumers hoạt động đồng thời.
- [ ] **Step 8: Cập nhật Dev/Prod variables, outputs và CD IAM allowlist** cho hai ZIP/function mới; giữ `content_api_endpoint` và queue output cũ tương thích.
- [ ] **Step 9: Chạy route/policy tests**: `Push-Location Backend; python -m pytest tests/test_routes.py -q; Pop-Location`; chạy `terraform fmt -check -recursive infrastructure`, rồi Terraform init/validate cho Dev và Prod theo RUNBOOK. Tạo plan hai môi trường để review, chưa apply.
- [ ] **Step 10: Kiểm tra plan**: không thay API ID/domain/authorizer, DynamoDB table, S3 bucket, Cognito hoặc Users resources; không xóa SQS queue có dữ liệu; chỉ có expected Lambda/integration/IAM/alarm/stream changes. Sửa mọi replacement ngoài phạm vi trước khi chấp thuận plan.
- [ ] **Step 11: Commit riêng** Terraform, IAM policy và parity tests thuộc task.

### Task 5: Cập nhật tài liệu vận hành chuẩn

**Files:**
- Modify: `docs/CONTEXT.md`
- Modify: `docs/RUNBOOK.md`
- Modify: `docs/MONITORING.md`
- Modify: `docs/TROUBLESHOOTING.md`

**Interfaces:**
- Consumes: tên Lambda/module/artifact/outputs thực tế sau Tasks 2–4 và baseline Task 1.
- Produces: kiến trúc, package/deploy/rollback, metrics/alarms và cách chẩn đoán thống nhất giữa bốn tài liệu.

- [ ] **Step 1: Cập nhật CONTEXT** để mô tả kiến trúc trong source/ Terraform sau Tasks 2–4, đồng thời ghi rõ trạng thái AWS chỉ được xác nhận sau Task 6/7: route ownership, handlers, IAM boundary, stream ownership và API contract.
- [ ] **Step 2: Cập nhật RUNBOOK** với ba artifact, tên biến/path ZIP, lệnh package/validate/plan/deploy theo environment, output queue mới và output tương thích.
- [ ] **Step 3: Cập nhật MONITORING** với baseline/sau deploy, tên Lambda mới, phân biệt cold/warm, log queries, alarm/IteratorAge/failure queue và so sánh route tương ứng.
- [ ] **Step 4: Cập nhật TROUBLESHOOTING** cho ZIP/manifest mismatch, route nhầm integration, missing Lambda permission, stream mapping/filter/retry, IAM AccessDenied và SQS failure messages; liên kết RUNBOOK/MONITORING thay vì lặp quy trình.
- [ ] **Step 5: Đối chiếu từng tài liệu với Terraform/source và rà link nội bộ**; không ghi hạ tầng AWS là đã chạy trước khi có xác nhận triển khai.
- [ ] **Step 6: Commit riêng** bốn tài liệu chuẩn.

### Task 6: Triển khai và nghiệm thu Dev — cần chấp thuận trước apply

**Files:**
- No source changes unless acceptance finds a defect; fix it in its owning task and update its docs.

**Interfaces:**
- Consumes: release artifact/checksum, Terraform plan đã review, baseline Dev và credentials/environment Dev do người vận hành cung cấp.
- Produces: bằng chứng Dev cutover, route/stream/IAM verification, so sánh metrics và rollback record.

- [ ] **Step 1: Xác minh release** có ba ZIP, manifest hợp lệ, source SHA đúng và plan khớp release; lưu lại artifact/revision trước đó để rollback.
- [ ] **Step 2: Trình bày Terraform plan Dev** và chỉ chạy apply sau khi người dùng chấp thuận rõ thao tác AWS Dev.
- [ ] **Step 3: Xác minh tài nguyên sau apply**: 14 route trỏ Lessons, 18 route trỏ Catalog, endpoint/authorizer không đổi, chỉ Lessons có MEDIA mapping, Users ACCOUNT mapping còn nguyên, alarms/queue/IAM hoạt động.
- [ ] **Step 4: Smoke test** login/role, lesson read/manage/save/publish, private notes, media upload/read/cleanup, program/reference read/manage/save/publish và Frontend; xác nhận draft/published, ownership và envelope.
- [ ] **Step 5: So sánh baseline cùng workload** theo Task 1; báo cáo Init Duration, duration p50/p95, API/browser latency, lỗi/throttle, stream age, queue và ZIP size. Chỉ kết luận cold-start cải thiện nếu dữ liệu chứng minh và warm/error/cost không thoái lui đáng kể.
- [ ] **Step 6: Nếu có lỗi**, dừng promotion; theo runbook rollback bằng release Terraform/artifact trước đó, xác nhận chỉ một MEDIA consumer đang chạy và ghi sự cố vào troubleshooting.
- [ ] **Step 7: Ghi kết quả và quyết định có đủ điều kiện sang Prod hay không**; không triển khai Prod trong task này.

### Task 7: Triển khai Prod sau Dev — cần chấp thuận riêng

**Files:**
- Update tài liệu vận hành với kết quả Prod nếu deploy được chấp thuận.

**Interfaces:**
- Consumes: Dev acceptance, release SHA đã nghiệm thu, Terraform plan Prod và chấp thuận rõ ràng cho Prod.
- Produces: bằng chứng triển khai/rollback Prod và metrics sau triển khai.

- [ ] **Step 1: Tạo, lưu và review Terraform plan Prod**; xác nhận không có thay đổi ngoài phạm vi, đặc biệt deletion protection, PITR, Users/Cognito/API identity và stateful queue.
- [ ] **Step 2: Dừng trước apply cho đến khi có chấp thuận rõ ràng riêng cho Prod.**
- [ ] **Step 3: Sau chấp thuận, deploy đúng release SHA đã nghiệm thu ở Dev; không rebuild artifact khác source SHA.**
- [ ] **Step 4: Chạy smoke/stream/route/monitoring verification như Task 6 và ghi kết quả vào tài liệu chuẩn.**
- [ ] **Step 5: Commit riêng tài liệu cập nhật sau deploy.**

## Thứ tự và điểm dừng

Tasks 1–5 chuẩn bị, triển khai code/config và review được mà không thay đổi AWS. Task 6 là điểm dừng trước mọi thao tác AWS Dev; Task 7 yêu cầu chấp thuận Prod riêng sau khi Dev đạt tiêu chí. Bất kỳ lỗi nào ở parity, permissions, stream, private note hoặc Terraform plan đều chặn deployment cho tới khi được sửa và kiểm tra lại.

