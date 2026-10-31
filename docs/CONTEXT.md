# Context hệ thống

Đối chiếu source ngày **20/10/2026**, múi giờ vận hành Asia/Bangkok. Đọc file này trước khi code. Đây là mô tả triển khai trong repository, không phải xác nhận trực tiếp tài nguyên hoặc phiên bản đang chạy trên AWS.

Đi tiếp theo công việc: [RUNBOOK](RUNBOOK.md) · [TROUBLESHOOTING](TROUBLESHOOTING.md) · [MONITORING](MONITORING.md). [Archive](archive/README.md) chỉ giữ lịch sử.

## 1. Mục đích và quyết định đã chốt

- Website tiếng Việt dành cho giáo lý viên: giáo án, chương trình học, tài liệu `Sinh hoạt`/`Kỹ năng`, danh bạ, tài khoản và ghi chú cá nhân.
- Mỗi giáo lý viên dùng một tài khoản do Admin cấp. Reader dùng chung là thiết kế cũ, đã bỏ.
- Đăng nhập hiện bằng **email và password**, theo Cognito `username_attributes = ["email"]`. Chưa chuyển sang username tùy ý.
- Frontend dùng `amazon-cognito-identity-js` và `localStorage` cho session, theo lựa chọn dùng máy cá nhân. Chuyển tab không yêu cầu đăng nhập lại chỉ vì đổi tab; browser vẫn có thể thu hồi storage hoặc phiên hết hạn.
- Terraform tạo User Pool, public app client và groups; Frontend chỉ khởi tạo đối tượng SDK trỏ tới pool/client đã có. Terraform không tạo user/password.
- Giáo án/chương trình/tài liệu lưu TipTap JSON, không lưu HTML hoặc chuỗi JSON thay cho document.
- Lưu nháp và xuất bản là hai hành động khác nhau. Reader chỉ đọc bản đã xuất bản.
- Ghi chú riêng thuộc JWT `sub`, không chỉnh sửa nội dung giáo án chung.
- Terraform trong repository hiện định nghĩa **hai API Gateway HTTP API và ba Lambda**: Content API chia route cho Lessons (14) và Catalog (18), còn Users giữ nguyên (16). Đây là trạng thái source/config; chưa xác nhận split đã được apply lên AWS. Trước cutover, môi trường có thể vẫn chạy content-api cũ.

## 2. Kiến trúc hiện hành

~~~mermaid
flowchart LR
  B[Trình duyệt] --> CF[CloudFront + OAC]
  CF --> FE[S3: frontend/]
  B --> C[Cognito: đăng nhập và refresh]
  B --> CG[Content HTTP API: JWT authorizer]
  B --> UG[Users HTTP API: JWT authorizer]
  CG --> LL[lessons-api Lambda: 14 routes]
  CG --> CAT[catalog-api Lambda: 18 routes]
  UG --> UL[users-api Lambda]
  LL --> DB[(DynamoDB)]
  CAT --> DB
  UL --> DB
  UL --> C
  LL --> M[S3: lesson-media/]
  B -->|presigned PUT/GET| M
  DB --> ST[DynamoDB Streams]
  ST -->|REMOVE MEDIA#| LL
  ST -->|REMOVE ACCOUNT#| UL
  LL -->|stream thất bại sau retry| CQ[SQS content failures]
  UL -->|stream thất bại sau retry| UQ[SQS users failures]
~~~

Frontend tĩnh gọi API trực tiếp; không có Next.js server/API routes làm backend. Mỗi môi trường có pool, table, app bucket, distribution, APIs/Lambdas và queues riêng. Bucket state tách khỏi app bucket.

| Phần | Công nghệ và cấu hình trong repo |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, TipTap 3; `output: 'export'` |
| Toolchain Frontend CI | Node `22.13.0`; pnpm `12.3.4`; dependency chính xác theo `pnpm-lock.yaml` |
| Backend | Python `3.12`; boto3/botocore pin trong [requirements](../Backend/requirements.txt) |
| Lambda | Python 3.12, x86_64, 256 MB, timeout 29 giây; chưa có provisioned concurrency/SnapStart trong Terraform |
| Hạ tầng | Terraform `>= 1.15`; CI/CD dùng `1.15.0`; AWS provider `~> 6.0`, giữ lockfile |
| AWS | Region mặc định `ap-southeast-1`; certificate frontend custom domain ở `us-east-1` |

Các giá trị trên phản ánh code hiện tại. Khi nâng version, sửa source/lockfile và tài liệu cùng nhau.

## 3. Bản đồ source

| Công việc | Điểm đọc/sửa chính |
| --- | --- |
| Điều phối màn hình, CRUD, trạng thái chỉnh sửa | [Frontend/app/page.tsx](../Frontend/app/page.tsx) |
| Public config và auth | [config.ts](../Frontend/lib/config.ts), [cognito.ts](../Frontend/lib/auth/cognito.ts), [auth-provider](../Frontend/components/auth-provider.tsx) |
| HTTP client, envelope, 401 và lỗi | [api/client.ts](../Frontend/lib/api/client.ts), [api/errors.ts](../Frontend/lib/api/errors.ts) |
| API/DTO nội dung và vòng đời CRUD | [api/content.ts](../Frontend/lib/api/content.ts), [content-management.ts](../Frontend/lib/api/content-management.ts) |
| Tài khoản, danh bạ, hồ sơ cá nhân | [api/users.ts](../Frontend/lib/api/users.ts), [account-management.ts](../Frontend/lib/api/account-management.ts), [personal-profile.ts](../Frontend/lib/api/personal-profile.ts) |
| Editor, bảng, cột, ảnh | [rich-text-extensions](../Frontend/components/rich-text-extensions.ts), [toolbar](../Frontend/components/rich-text-toolbar.tsx), [lesson-media](../Frontend/lib/lesson-media.ts), [program-schedule-editor](../Frontend/components/program-schedule-editor.tsx) |
| Ghi chú Frontend | [lesson-with-notes](../Frontend/components/lesson-with-notes.tsx), [lesson-note-anchors](../Frontend/lib/lesson-note-anchors.ts), [api/lesson-notes](../Frontend/lib/api/lesson-notes.ts) |
| Themes/giao diện | [app/styles](../Frontend/app/styles/), [theme-provider](../Frontend/components/theme-provider.tsx), [theme-preference](../Frontend/lib/theme-preference.ts) |
| Route và HTTP boundary Backend | [Lessons routes](../Backend/lessons_api/routes.py), [Catalog routes](../Backend/catalog_api/routes.py), [content service registry](../Backend/content_api/routes.py), [users routes](../Backend/users_api/routes.py), [shared/http.py](../Backend/shared/http.py) |
| Quyền và thu hồi phiên | [shared/auth.py](../Backend/shared/auth.py), [personal_account.py](../Backend/shared/personal_account.py) |
| Revision, publish, archive/restore | [content.py](../Backend/content_api/services/content.py) |
| Media ownership, phiên bản S3, cleanup | [media.py](../Backend/content_api/services/media.py), [media_lifecycle.py](../Backend/content_api/services/media_lifecycle.py) |
| Hồ sơ, account, compensation và TTL cleanup | [users services](../Backend/users_api/services/), [users stream](../Backend/users_api/stream.py) |
| Ghi chú và neo văn bản Backend | [lesson_notes.py](../Backend/content_api/services/lesson_notes.py), [note_anchors.py](../Backend/content_api/services/note_anchors.py) |
| Schema rich text và truy cập DB | [tiptap_validator.py](../Backend/shared/tiptap_validator.py), [db.py](../Backend/shared/db.py) |
| Hạ tầng, quyền Lambda | [modules](../infrastructure/modules/), [dev](../infrastructure/environments/dev/), [prod](../infrastructure/environments/prod/) |
| Release và kiểm thử | [.github/workflows](../.github/workflows/), [scripts/ci](../scripts/ci/), [scripts/cd](../scripts/cd/), [Backend/tests](../Backend/tests/), [Frontend/tests](../Frontend/tests/) |

Các thư mục `controllers` và một số `__init__.py` vẫn có comment scaffold cũ; runtime hiện đi từ route registry tới service. Không suy ra toàn bộ backend chưa viết chỉ từ các comment TODO này.

## 4. Đăng nhập và phân quyền

1. SDK gửi đăng nhập trực tiếp tới Cognito bằng `USER_PASSWORD_AUTH`, có xử lý `NEW_PASSWORD_REQUIRED` và khôi phục/refresh session.
2. Public app client không có client secret; access/id token mặc định 1 giờ, refresh token 30 ngày theo module identity.
3. Browser gọi đúng API với `Authorization: Bearer <access-token>`. ID token không dùng làm token gọi API.
4. Gateway kiểm tra issuer/audience và scope `aws.cognito.signin.user.admin`.
5. Lambda đọc claims đã được Gateway xác minh tại `event.requestContext.authorizer.jwt.claims`; kiểm tra `token_use`, client, group, `sub`, rồi đọc ACCOUNT hiện tại.
6. ACCOUNT không ACTIVE, đang pending disable/archive, role lệch hoặc token cũ hơn `tokenValidAfter` sẽ bị từ chối. Enable/restore xong phải đăng nhập lại.

`requestContext` là trường trong payload v2 của API Gateway, không phải khóa tùy đặt hay dữ liệu frontend cần tự gửi. Quyền invoke Lambda trực tiếp cũng phải được bảo vệ bằng IAM; validator trong handler dựa vào sự tin cậy của nguồn Gateway.

| Quyền | reader | editor | admin |
| --- | --- | --- | --- |
| Đọc bản xuất bản và danh bạ | Có | Có | Có |
| Sửa/publish/archive nội dung, quản lý danh bạ | Không | Có | Có |
| Xem/cập nhật hồ sơ liên kết của mình | Có | Có | Có |
| Ghi chú riêng trên bản giáo án xuất bản | Có | Có | Có |
| Quản lý tài khoản Reader/Editor | Không | Không | Có |
| Sửa/disable/archive ADMIN qua API | Không | Không | Không |

`LAST_ADMIN_PROTECTED` hiện bảo vệ **mọi ACCOUNT có role ADMIN** qua API, không chỉ admin cuối cùng. Admin đầu tiên do operator tạo bằng [create_admin.py](../Backend/scripts/create_admin.py).

Cognito lưu danh tính/credentials; DynamoDB ACCOUNT lưu role, trạng thái, liên kết và revocation của ứng dụng. Chỉ có user Cognito chưa đủ để API chấp nhận.

## 5. Hồ sơ cá nhân và ghi chú

- Hồ sơ giáo lý viên (`catechistId`) độc lập với ACCOUNT (`cognitoSub`). Reader và Editor mới đều phải được Admin liên kết tới hồ sơ đã tạo.
- Một hồ sơ có tối đa một tài khoản chưa DELETED; DISABLED vẫn giữ quyền liên kết. Reverse-link cũ có thể còn trong thời gian retention; không đồng nghĩa cho phép dùng chung.
- Account cũ chưa liên kết vẫn đăng nhập/đọc được. Admin gán thủ công bằng ID; không đoán theo email/tên.
- Archive hồ sơ gỡ liên kết nhưng không disable/xóa account. Restore hồ sơ không tự nối lại.
- Menu tài khoản hiển thị tên hồ sơ, hoặc email đăng nhập khi thiếu hồ sơ. Người dùng tự sửa email liên hệ, số điện thoại, lớp chủ nhiệm (`group`), lớp đồng hành (`accompanyingClass`).
- Email liên hệ không đổi email đăng nhập Cognito; tên, role và trạng thái thuộc quản lý của Admin/Editor theo quyền.
- Bôi đen chữ trên giáo án PUBLISHED mới hiện tùy chọn `Viết ghi chú`; bấm tùy chọn mới mở hộp nhập. Admin/Editor mở chế độ bản đã xuất bản để dùng ghi chú.
- Note lấy owner từ JWT `sub`, không nhận owner từ request. API không cho tài khoản khác, kể cả Admin, đọc note của người khác. Người có quyền AWS trực tiếp vẫn chịu quyền truy cập DynamoDB riêng.
- Note là văn bản thuần tối đa 8000 ký tự; 100 note/tài khoản/bài. Create dùng UUID `noteId` cố định khi retry; cùng ID khác nội dung trả xung đột.
- Anchor gồm `fieldId, start, end, exactQuote, prefix, suffix, sourceHash`; offsets theo Unicode code point, SHA-256 UTF-8. `exactQuote` tối đa 2000 ký tự; ngữ cảnh tối đa 120 ký tự mỗi phía.
- Field được neo: `scripture`, `keyPoints`, `sentiment`, `preparation`, `section:<key>`. Hash/trích đoạn chỉ được dùng khi khớp chắc chắn; note mất vị trí vẫn có trong danh sách riêng.
- Mọi cập nhật dùng version/transaction chống ghi đè giữa các tab. Ghi note không sửa revision giáo án.
- Archive giáo án không purge note ngay. Users TTL cleanup xóa note/quota khi ACCOUNT hết retention; chưa có policy purge note riêng theo TTL của giáo án.

## 6. DynamoDB và vòng đời dữ liệu

Một table on-demand mỗi môi trường, tên mặc định `giaoan-dev`/`giaoan-prod`, PK/SK string, GSI1, TTL `purgeAt`, Streams `NEW_AND_OLD_IMAGES`.

DynamoDB giới hạn 400 KiB mỗi item, gồm tên thuộc tính và dữ liệu. Giới hạn rich text 200 KiB của ứng dụng không thay thế giới hạn tổng item; cấu trúc metadata/schedule quá lớn vẫn cần đánh giá kích thước khi mở rộng.

| Entity | PK | SK / nội dung |
| --- | --- | --- |
| Giáo án | `LESSON#<lessonId>` | `META`, `DRAFT`, `PUBLISHED` |
| Liên kết ảnh giáo án | `LESSON#<lessonId>` | `MEDIA#<mediaId>` |
| Chương trình | `PROGRAM#<programId>` | `META`, `DRAFT`, `PUBLISHED` |
| Tài liệu tham khảo | `REFERENCE#<referenceId>` | `META`, `DRAFT`, `PUBLISHED` |
| Hồ sơ giáo lý viên | `CATECHIST#<catechistId>` | `PROFILE` |
| Reverse link hồ sơ/account | `CATECHIST#<catechistId>` | `ACCOUNT#<sub>` |
| Tài khoản | `ACCOUNT#<sub>` | `PROFILE` |
| Note riêng | `ACCOUNT#<sub>` | `LESSONNOTE#<lessonId>#<noteId>` |
| Quota note | `ACCOUNT#<sub>` | `LESSONNOTECOUNT#<lessonId>` |
| Ảnh và phiên bản object | `MEDIA#<mediaId>` | `PROFILE` |

GSI1 dùng `GSI1PK/GSI1SK` và **KEYS_ONLY**, không phải INCLUDE. Các partition gồm `CATALOG#LESSON`, `CATALOG#PROGRAM`, `CATALOG#REFERENCE#<category>`, `DIRECTORY#CATECHIST`, `DIRECTORY#ACCOUNT`. Catalog/index chỉ tìm key; API đọc lại base table để kiểm tra trạng thái/revision mới nhất. Không đưa nội dung rich text vào GSI; note không có GSI.

ID nội dung do backend sinh bằng prefix + UUID hex, không dựa vào thứ tự thêm. Timestamp audit là UTC ISO-8601; `purgeAt` là Unix epoch giây.

Vòng đời nội dung:

1. Tạo → META + DRAFT, `hasPublished=false`.
2. Save → cập nhật DRAFT và tăng META version; PUBLISHED cũ vẫn phục vụ Reader.
3. Publish → copy DRAFT thành PUBLISHED, tăng version, xóa DRAFT trong transaction. Không có lịch sử revision dài hạn.
4. Archive → ẩn khỏi Reader ngay, đặt DELETED và retention 10 ngày trên các item liên quan.
5. Restore trong retention → bỏ TTL, khôi phục trạng thái và kiểm tra lại media.
6. TTL xóa vật lý bất đồng bộ sau hạn; không phải đồng hồ chạy đúng giây. Streams kích hoạt cleanup ngoại vi.

Account transitions có marker `pendingAction/pendingUntil/pendingToken`, lease 120 giây để retry khi Cognito và DB chưa đồng bộ. Retry cùng action sau lease; không đổi sang action đối nghịch để né lỗi.

Prod bật DynamoDB PITR/deletion protection và Cognito deletion protection. Restore DB không tự phục hồi Cognito user hoặc S3 bytes; xem RUNBOOK trước thao tác khôi phục.

## 7. Hợp đồng HTTP hiện hành

**48 route: Lessons 14, Catalog 18, Users 16.** Ba registry Python và bản đồ route Terraform là nguồn thực thi. [test_routes.py](../Backend/tests/test_routes.py) đối chiếu route của cả ba Lambda với bảng này. Khi thêm route phải sửa context, registry, Terraform và client/test liên quan.

R/E/A lần lượt là reader/editor/admin. Tất cả route bên dưới yêu cầu xác thực.

### Content API

| Method và path | Quyền | Chức năng/body |
| --- | --- | --- |
| `GET /lessons` | R/E/A | Catalog PUBLISHED |
| `GET /lessons/{lessonId}` | R/E/A | Chi tiết PUBLISHED, ký URL ảnh của revision |
| `GET /programs` | R/E/A | Catalog chương trình PUBLISHED |
| `GET /programs/{programId}` | R/E/A | Chi tiết chương trình PUBLISHED |
| `GET /references` | R/E/A | Catalog PUBLISHED theo category |
| `GET /references/{referenceId}` | R/E/A | Nội dung tham khảo PUBLISHED |
| `GET /manage/lessons` | E/A | Catalog quản lý, có thể gồm thùng rác |
| `GET /manage/lessons/{lessonId}` | E/A | DRAFT nếu có, nếu không PUBLISHED; META version |
| `POST /manage/lessons` | E/A | Tạo nháp; payload giáo án, không gửi version |
| `PUT /manage/lessons/{lessonId}/draft` | E/A | Payload giáo án + version đã đọc |
| `POST /manage/lessons/{lessonId}/publish` | E/A | `{version}` |
| `DELETE /manage/lessons/{lessonId}` | E/A | Archive, body rỗng |
| `POST /manage/lessons/{lessonId}/restore` | E/A | Restore, body rỗng |
| `POST /manage/lessons/{lessonId}/media-upload-url` | E/A | `{mimeType,sizeBytes}` |
| `GET /manage/programs` | E/A | Catalog quản lý |
| `GET /manage/programs/{programId}` | E/A | DRAFT/PUBLISHED để tiếp tục sửa |
| `POST /manage/programs` | E/A | Payload chương trình |
| `PUT /manage/programs/{programId}/draft` | E/A | Payload + version |
| `POST /manage/programs/{programId}/publish` | E/A | `{version}` |
| `DELETE /manage/programs/{programId}` | E/A | Archive |
| `POST /manage/programs/{programId}/restore` | E/A | Restore |
| `GET /manage/references` | E/A | Catalog quản lý |
| `GET /manage/references/{referenceId}` | E/A | DRAFT/PUBLISHED |
| `POST /manage/references` | E/A | Payload tài liệu tham khảo |
| `PUT /manage/references/{referenceId}/draft` | E/A | Payload + version |
| `POST /manage/references/{referenceId}/publish` | E/A | `{version}` |
| `DELETE /manage/references/{referenceId}` | E/A | Archive |
| `POST /manage/references/{referenceId}/restore` | E/A | Restore |
| `GET /me/lessons/{lessonId}/notes` | R/E/A | Note của sub hiện tại trên bài PUBLISHED |
| `POST /me/lessons/{lessonId}/notes` | R/E/A | `{noteId,anchor,body}` |
| `PUT /me/lessons/{lessonId}/notes/{noteId}` | R/E/A | `{body,version}` |
| `DELETE /me/lessons/{lessonId}/notes/{noteId}` | R/E/A | `{version}`; lặp lại an toàn |

### Users API

| Method và path | Quyền | Chức năng/body |
| --- | --- | --- |
| `GET /me` | R/E/A | Danh tính, displayName, loginEmail và profile hoặc null |
| `PUT /me/profile` | R/E/A | `{email,phone,group,accompanyingClass,version}` của profile liên kết |
| `GET /catechists` | R/E/A | Danh bạ chưa archive |
| `GET /manage/catechists` | E/A | Danh bạ quản lý, includeDeleted |
| `POST /manage/catechists` | E/A | Tạo hồ sơ độc lập |
| `PUT /manage/catechists/{catechistId}` | E/A | Payload hồ sơ + version |
| `DELETE /manage/catechists/{catechistId}` | E/A | Archive và gỡ liên kết |
| `POST /manage/catechists/{catechistId}/restore` | E/A | Restore, không tự nối account |
| `GET /admin/accounts` | A | Danh sách; không trả password |
| `POST /admin/accounts` | A | `{email,password,role,catechistId}`; role EDITOR/READER |
| `PUT /admin/accounts/{cognitoSub}/catechist-link` | A | `{catechistId}` |
| `POST /admin/accounts/{cognitoSub}/reset-password` | A | `{password}`, permanent password |
| `POST /admin/accounts/{cognitoSub}/disable` | A | Disable, body rỗng |
| `POST /admin/accounts/{cognitoSub}/enable` | A | Enable, body rỗng |
| `DELETE /admin/accounts/{cognitoSub}` | A | Archive, disable ngay |
| `POST /admin/accounts/{cognitoSub}/restore` | A | Restore trong retention |

### Envelope, danh sách và lỗi

~~~json
{"data": {}, "meta": {"requestId": "request-id"}}
~~~

~~~json
{"error": {"code": "VERSION_CONFLICT", "message": "...", "details": []},
 "meta": {"requestId": "request-id"}}
~~~

- List trả `data` là array, `meta.nextCursor` khi còn trang. Limit mặc định 20, tối đa 50. Cursor gắn với filter/scope; đổi filter phải bỏ cursor cũ.
- Filter nội dung: `q, level, sublevel`; giáo án thêm `lessonNumber`; tài liệu dùng `category`. Quản lý thêm `includeDeleted=true`. Danh bạ dùng `q`; account thêm `role,status`.
- `q` tìm chuỗi đã chuẩn hóa, không phải full-text search. Backend paginate theo normalized title/name/email + ID. Frontend sắp danh sách giáo án theo số bài để hiển thị; không suy ra thứ tự từ thời điểm tạo.
- POST tạo nội dung/profile/account/note trả 201; phần lớn thao tác khác trả 200.
- Mã thường gặp: 400 VALIDATION_ERROR; 401 UNAUTHORIZED; 403 FORBIDDEN; 404 NOT_FOUND; 409 VERSION_CONFLICT/EMAIL_ALREADY_EXISTS/PROFILE_ALREADY_LINKED/PROFILE_NOT_LINKED/NOTE_LIMIT/LAST_ADMIN_PROTECTED; 413 CONTENT_TOO_LARGE; 500 INTERNAL_ERROR.
- Không gửi field audit/role/owner do server quản lý. `version` gửi lên là version đã đọc để so sánh, không tự tính version mới.
- Gateway có thể trả lỗi trước Lambda với envelope khác. Frontend HTTP client có thông báo dự phòng theo status.

## 8. Payload và editor

| Loại | Các field nghiệp vụ |
| --- | --- |
| Giáo án | `title, summary, level, sublevel, lessonNumber, durationMinutes, scriptureText, scriptureReference, keyPoints, sentiment, preparation, progression, sections` |
| Chương trình | `title, description, level, sublevel, scheduleColumns, schedule` |
| Tham khảo | `title, category, content`; category chỉ `Sinh hoạt`/`Kỹ năng` |
| Hồ sơ | `name, email, phone, group, accompanyingClass, status`; status ACTIVE/PAUSED/INACTIVE |

Các field rich text là TipTap document object: `keyPoints, sentiment, preparation`, `progression[].teacherActivity/learnerActivity`, `sections[].content`, ô schedule, `reference.content`. `scriptureText` và metadata vẫn là string. `sections` có key/title ổn định; `progression` tối đa 200 hàng, `sections` tối đa 100 mục. `lessonNumber/durationMinutes` là integer 1–10000.

Chương trình định nghĩa cột riêng (`scheduleColumns[{id,label}]`, 1–30 cột), tối đa 500 hàng. Mỗi hàng có `id, values` cho đủ mọi column ID, `mergedCellGroups` liền kề/không chồng lấn và `cellBackgrounds` tùy chọn dạng `{columnId:"#rrggbb"}`. Màu gắn với ID cột; ô gộp dùng màu ô đầu, tách ô giữ giá trị màu riêng. Tô nền ô hiện chỉ áp dụng cho lịch chương trình học.

Giới hạn và allowlist:

- HTTP body tối đa 300 KiB theo parser; tổng rich text/revision tối đa 200 KiB UTF-8 serialized; depth 24, tối đa 12000 node/document.
- Mark: bold, italic, strike, underline, code, link, textStyle. Mark hợp lệ trên inline text/hardBreak/image được chấp nhận.
- Cỡ chữ: 12/14/16/18/20/24/28/32 px; font family theo allowlist trong [validator](../Backend/shared/tiptap_validator.py). Hiện gồm Georgia, Arial, font sans của app và Times New Roman.
- `textStyle` null/chuỗi rỗng là định dạng mặc định; chuỗi rỗng được chuẩn hóa. Màu chữ rõ ràng dùng `#RRGGBB`.
- Chia cột 2 hoặc 3 cột; bảng rich text tối đa 200 hàng/40 cột, kiểm tra ô gộp/độ rộng. `colwidth` được làm tròn trước khi ghi DynamoDB.
- Ảnh chỉ cho giáo án, lưu `mediaId,alt,width,alignment`; width 40–1600 px. Không lưu `attrs.src`, data URL, base64 hoặc presigned URL bền vững.
- Thêm node/mark/format mới phải đồng bộ extension + serializer Frontend + validator Backend + kiểm thử save/reload, không chỉ thêm nút toolbar.

UI đã có toolbar bám vùng soạn, giữ ký tự đầu dòng `1. `/`- `/`* `/`+ `, Chuẩn bị tùy chọn, Tiến trình lên lớp là đề mục, bảng và chỉnh kích thước ảnh. Light/dark thay giao diện; giấy đọc/in và màu người soạn không bị đổi tự động.

Các lựa chọn giao diện cần giữ khi tiếp tục thiết kế:

- Năm ngành giữ màu nhận diện trong [content-data.ts](../Frontend/lib/content-data.ts): Chiên con hồng, Ấu nhi xanh lá nhạt, Thiếu Nhi xanh dương, Nghĩa sĩ vàng, Hiệp sĩ nâu.
- Desktop giữ bố cục tổng quan hai cột, có ảnh kính màu bên phải. Ở màn hình điện thoại, header giữ logo và tên thương hiệu trên một hàng, ảnh kính màu làm họa tiết mờ bên phải của hero, thống kê và footer thu gọn theo chiều ngang; các điều chỉnh chỉ áp dụng dưới 600px.
- Trang chương trình hiện dùng các thẻ theo timeline/số thứ tự; tiêu đề, mô tả và nút thêm ở banner đầu. Người dùng muốn bám sát mock đã duyệt; không suy ra đã khớp từng pixel chỉ từ việc có các thành phần này.
- Nền banner chương trình hiện là `Frontend/public/images/program-hero-background.png`, được tái tạo sạch từ ảnh crop người dùng chọn. Ảnh trang Tổng quan là `stained-glass-hero-expanded.png`, là asset khác; đã có lần lấy nhầm ảnh này cho chương trình.
- Lời Chúa ở đầu bài căn giữa; cột có đường kẻ phân cách và nội dung bắt đầu cùng hàng. Trên điện thoại giữ cách đọc gần desktop, dùng cuộn ngang cho bảng khi cần.
- Thông báo lưu nháp/xuất bản nằm ở phần điều khiển, không chen vào nội dung bài; thao tác save phải phản ánh kết quả API và giữ bản đang nhập nếu lỗi.

## 9. Media, hosting và cleanup

App bucket private, encrypted, versioning bật:

- `frontend/`: static export do CloudFront OAC đọc.
- `lesson-media/`: ảnh private; CloudFront không có quyền đọc prefix này.
- Bucket state chỉ chứa Terraform state/lock; không chứa frontend hoặc media.

Luồng ảnh: tạo nháp lấy lessonId thật → xin presigned PUT 5 phút → browser PUT bytes + đúng Content-Type → save/publish kiểm tra HEAD, owner, MIME, kích thước và VersionId → ghi mediaId/phiên bản cố định → read trả presigned GET 15 phút. JPEG/PNG/WebP tối đa 5 MiB; tối đa 40 media khác nhau trong hợp DRAFT/PUBLISHED của một bài.

Ảnh upload chưa gắn: TTL 1 ngày. Ảnh không còn trong cả draft/published: retention 10 ngày. Archive bài đặt cùng hạn giữ media. DRAFT bỏ ảnh nhưng PUBLISHED vẫn tham chiếu thì ảnh còn được giữ. Cleanup xóa các version/delete marker của đúng object; không cấu hình tự expire toàn bộ noncurrent media vì bản published có thể đang dùng.

Source Terraform định nghĩa ba Lambda; chỉ Lessons và Users nhận DynamoDB Streams. Catalog không có stream mapping:

| Consumer | Filter | Hành động |
| --- | --- | --- |
| lessons-api | REMOVE, OldImage PK prefix MEDIA# | Kiểm tra record cũ/TTL/trạng thái hiện tại, xóa đúng object versions |
| users-api | REMOVE, OldImage PK prefix ACCOUNT# | Kiểm tra TTL deletion, ACCOUNT không được tạo lại; dọn note/quota, Cognito và link |

Hai mapping giữ batch 10, retry tối đa 10, max record age 86400 giây, bisection và partial batch response. Queue media giữ tên vật lý cũ `*-content-api-stream-failures` để Terraform có thể nhận lại queue mà không tạo queue mới; output `content_stream_failure_queue_url` vẫn là alias tương thích, output chuẩn mới là `lessons_stream_failure_queue_url`. SQS failure destination giữ 14 ngày nhưng **chưa có consumer replay tự động**. Message SQS không phải backup đầy đủ của item; Streams chỉ giữ record 24 giờ. Quy trình xử lý ở MONITORING/TROUBLESHOOTING.

## 10. Local, release và cấu hình

- Local mock chỉ bật trong `NODE_ENV=development` và cờ `NEXT_PUBLIC_ENABLE_LOCAL_AUTH_MOCK=true`. Tài khoản fake hiện được cấp role admin cho thiết kế UI, không phải admin Cognito; service AWS bị bỏ qua ở luồng này, dữ liệu có thể chỉ tồn tại trong memory.
- Thử persistence/quyền thực phải tắt mock, dùng pool/API Dev và tạo tài khoản có ACCOUNT/hồ sơ đúng. Test browser offline là bộ mô phỏng riêng, không phải nghiệm thu AWS.
- `NEXT_PUBLIC_*` là public và được nhúng lúc build. Sửa `.env.local` cần restart dev server hoặc rebuild/deploy; không đặt secret ở đây.
- Build local không tự sync S3. Next static export ở `Frontend/out/`; `next start` không phải cách phục vụ output export. Xem RUNBOOK cho dev/build/browser tests.
- Backend CI tạo `lessons-api.zip`, `catalog-api.zip`, `users-api.zip` và manifest trên mỗi push main; artifact gắn SHA toàn repository, giữ 30 ngày.
- CD thủ công chọn Backend run ID → xác minh SHA/checksum → OIDC → Terraform → build Frontend bằng outputs → upload đúng prefix → chờ CloudFront deployment/invalidation → smoke test.
- Dev/prod dùng state keys riêng trong `infrastructure/environments/*/backend.tf`. Bootstrap state là root riêng. Không đổi state key để chữa lỗi deploy.
- Tên workflow `CD-DEV Pipeline` hiện vẫn cho chọn cả dev/prod. Input Environment và role mới quyết định đích.

## 11. Việc còn lại và giới hạn đã biết

Các mục dưới đây là việc cần đánh giá, **chưa phải tính năng đã triển khai**:

1. Người dùng báo request đầu chậm. Chưa có baseline CloudWatch đính kèm xác định phần INIT/handler/network. Cần đo theo MONITORING trước khi khẳng định nguyên nhân hoặc lợi ích cold-start của split.
2. Source đã chia route/handler, ZIP, IAM và Terraform thành Lessons/Catalog; ghi chú cá nhân vẫn ở Lessons. Chưa có bằng chứng split đã được apply lên AWS. Trước apply cần baseline Dev và review plan xác nhận tài nguyên stateful không bị thay thế.
3. Lessons nạp media handler lười khi nhận stream; Catalog không đóng gói media/S3/Streams/SQS. SDK client được tạo trong request path ở một số service; có thể tối ưu reuse/import và benchmark memory, giữ dữ liệu user/account theo request.
4. Catalog Query rồi đọc lại từng base-table snapshot trước khi paginate trong memory; tránh Scan nhưng vẫn tăng chi phí/thời gian theo số item. Tách Lambda không tự sửa thuật toán này.
5. Release không atomic: Terraform apply trước Frontend build; lỗi build có thể để backend mới đi cùng UI cũ. CD chưa tự gate toàn bộ CI độc lập.
6. Chưa có dashboard, alarm latency/error-rate API, X-Ray/tracing hay log timing từng bước trong Terraform. API access log hiện chưa ghi integration latency; log Lambda lỗi ứng dụng chỉ có request ID/type tối thiểu.
7. IAM JSON CD chứa grant chẩn đoán/hardcode ID và quyền logging rộng theo region; không coi đó là bộ policy production đã kiểm chứng cho mọi cấu hình.
8. CI phân loại đường dẫn qua `scripts/ci/detect_changes.py`: PR dùng `DIFF_MODE=three-dot`, push/merge group dùng two-dot. Backend vẫn tạo artifact trên mỗi push main để giữ hợp đồng release hiện tại; cache dependencies/build không thay thế kiểm thử hay xác minh SHA/checksum. Chi tiết cache ở RUNBOOK.
9. Frontend note textarea đếm UTF-16 trong khi Backend đếm code point; nội dung nhiều emoji có thể chạm giới hạn Frontend sớm hơn. Ghi nhận lịch sử cần kiểm tra lại khi sửa.

## 12. Quy tắc giữ tài liệu đúng

| Thay đổi | Tài liệu cần cập nhật |
| --- | --- |
| Kiến trúc, route, schema, quyền, ràng buộc UI/API | CONTEXT |
| Cách cài/chạy/deploy/rollback/destroy, toolchain và env | RUNBOOK |
| Một sự cố mới hoặc nguyên nhân đã xác nhận | TROUBLESHOOTING |
| Log, metric, alarm, truy vấn, lịch theo dõi, trách nhiệm phản hồi | MONITORING |

Không chép secret/tfvars/state/token/password vào tài liệu. Không ghi số test pass lịch sử thành kết quả hiện tại. Giữ nguồn bằng chứng: source path, release SHA, log/request ID đã lọc; tách rõ nguyên nhân đã chứng minh và giả thuyết.

Tham khảo chuẩn: [API Gateway payload v2](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html), [Lambda execution reuse](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html), [DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html), [Stream failure destinations](https://docs.aws.amazon.com/lambda/latest/dg/services-dynamodb-errors.html).
