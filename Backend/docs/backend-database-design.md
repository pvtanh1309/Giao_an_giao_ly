# Thiết kế Backend và Cơ sở dữ liệu

## 1. Mục tiêu và phạm vi

Tài liệu này mô tả thiết kế nền tảng. Backend Python và Terraform đã được triển khai; API contract và deployment runbook ghi hành vi hiện hành, bao gồm các cập nhật bên dưới.

Triển khai hiện hành: 42 route, đọc revision bằng TransactGetItems, metadata đã xóa vẫn trong GSI để editor tìm thùng rác (reader luôn kiểm tra ACTIVE/PUBLISHED), catalog LESSON/PROGRAM dùng partition toàn loại cho filter tùy chọn, profile deletion chỉ unlink account. S3 versioning cố định VersionId đã xác minh; ACCOUNT status và tokenValidAfter chặn phiên cũ sau disable. Xem [runbook](deployment-runbook.md).

Mục tiêu:

- Cung cấp API an toàn cho frontend tĩnh chạy trên S3 + CloudFront.
- Cho phép người dùng đã đăng nhập đọc toàn bộ giáo án, chương trình học và danh bạ giáo lý viên.
- Cho phép admin tạo, soạn nháp, xuất bản, lưu trữ, khôi phục và quản lý tài khoản.
- Đảm bảo nội dung đang soạn không hiển thị cho người dùng.
- Tối ưu chi phí và độ trễ cho khoảng 120 người dùng tại Việt Nam.
- Thiết kế đủ rõ để người phát triển có thể tự viết code Python sau này.

Ngoài phạm vi hiện tại:

- Đăng ký tài khoản tự do.
- Phân quyền theo ngành/phân ngành.
- MFA.
- Lưu lịch sử mọi phiên bản.
- Tìm kiếm toàn văn.
- Upload file/PDF độc lập. Ảnh minh họa inline trong giáo án thuộc phạm vi; bytes ảnh lưu trong S3, không lưu DynamoDB.

## 2. Các quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Region | `ap-southeast-1` (Singapore) |
| Backend | Python 3.12, Lambda handler/router thuần Python |
| API | Hai API Gateway HTTP API: `content-api` và `users-api` |
| Authentication | Amazon Cognito User Pool |
| Authorization | Cognito Groups: `admin`, `editor`, `reader` |
| Database | DynamoDB Standard, On-Demand, một Region |
| Hạ tầng | Terraform |
| Môi trường | `dev` và `prod`, variables/state riêng |
| Nội dung | Text/HTML lưu trực tiếp trong DynamoDB |
| Tìm kiếm | Tiêu đề, ngành, phân ngành, số bài |
| Xóa | Soft delete 10 ngày, sau đó DynamoDB TTL xóa |
| Phiên bản | Chỉ giữ bản nháp hiện tại và bản xuất bản hiện tại |
| Chương trình năm cũ | Ghi đè, chỉ giữ chương trình hiện hành |
| MFA | Không dùng |
| Tạo tài khoản | Admin tạo Editor/Reader, cấp mật khẩu cố định và liên kết Editor với hồ sơ có sẵn |

## 3. Kiến trúc tổng quan

```text
Browser
  │
  ├── CloudFront ── S3 app bucket (prefix `frontend/` và `lesson-media/`)
  │
  ├── Cognito User Pool: đăng nhập, token, nhóm quyền
  │
  ├── content-api.<domain>
  │     └── API Gateway HTTP API + JWT Authorizer
  │             └── content-api Lambda
  │                   ├── Lessons
  │                   └── Programs / Draft / Publish / Delete / Restore
  │
  └── users-api.<domain>
        └── API Gateway HTTP API + JWT Authorizer
                └── users-api Lambda
                      ├── Catechist profiles
                      ├── Cognito account management
                      └── DynamoDB Stream: content-api dọn ảnh S3; users-api xóa Cognito user sau TTL

DynamoDB: GiaoLyTable
CloudWatch: logs, alarms
AWS Budgets: cảnh báo chi phí
```

### 3.1. Phân tách Lambda

- **content-api**: đi sau `content-api` Gateway; xử lý giáo án, chương trình học, tài liệu tham khảo, cấp presigned URL và dọn ảnh S3 qua stream.
- **users-api**: đi sau `users-api` Gateway; xử lý hồ sơ giáo lý viên, tạo/disable/enable/xóa Cognito user, quản lý liên kết Editor với hồ sơ và xử lý DynamoDB Stream khi account hết thời hạn lưu trữ.

Không cần Lambda dọn dữ liệu riêng: DynamoDB TTL xóa bản ghi sau 10 ngày. DynamoDB Stream hiện hữu được cấu hình `NEW_AND_OLD_IMAGES` và fan-out tới hai Lambda hiện có theo loại item: `users-api` xóa Cognito user khi account hết hạn; `content-api` xóa object S3 khi MEDIA item hết TTL. Mỗi consumer bỏ qua loại entity không thuộc trách nhiệm của nó và xử lý lặp an toàn; cấu hình retry/DLQ/cảnh báo cho lỗi xử lý. Không tạo Lambda/API Gateway/table mới.

### 3.2. Luồng đăng nhập

1. Frontend gửi email/password trực tiếp đến Cognito.
2. Cognito trả token cho frontend sau khi đăng nhập thành công.
3. Frontend gọi content API hoặc users API kèm `Authorization: Bearer <access-token>`.
4. Gateway tương ứng xác minh token trước khi gọi Lambda tương ứng.
5. Lambda đọc `sub` và `cognito:groups` từ claims để kiểm tra quyền.

Backend không xác thực password, không lưu password và không trả password trong response.

## 4. Quyền truy cập

| Hành động | reader | editor | admin |
|---|---:|---:|---:|
| Đọc giáo án đã xuất bản | Có | Có | Có |
| Đọc chương trình đã xuất bản | Có | Có | Có |
| Đọc danh bạ giáo lý viên | Có | Có | Có |
| Tạo/sửa draft giáo án, chương trình | Không | Có | Có |
| Xuất bản | Không | Có | Có |
| Lưu trữ/khôi phục nội dung | Không | Có | Có |
| Tạo/sửa/lưu trữ giáo lý viên | Không | Có | Có |
| Quản lý tài khoản Cognito | Không | Không | Có |

Frontend chỉ ẩn/hiện nút theo role để cải thiện trải nghiệm. Lambda phải kiểm tra `editor` hoặc `admin` cho route quản lý nội dung, và chỉ `admin` cho route quản lý account.

## 5. Vòng đời nội dung

### 5.1. Giáo án và chương trình

```text
Tạo mới
  META + DRAFT
      │
      ├── admin tiếp tục sửa DRAFT
      │
      └── Xuất bản
             ├── ghi PUBLISHED từ DRAFT
             ├── cập nhật META
             └── xóa DRAFT
                  │
                  └── Sửa lại
                        ├── copy PUBLISHED sang DRAFT
                        └── người dùng vẫn xem PUBLISHED
```

Khi publish, backend sử dụng DynamoDB transaction:

1. `Put` hoặc ghi đè item `PUBLISHED` bằng nội dung item `DRAFT`.
2. `Update` item `META`: trạng thái, version, `publishedAt`, `publishedBy`.
3. `Delete` item `DRAFT`.

Nếu transaction thất bại, không có thay đổi nào được áp dụng; bản nháp vẫn còn nguyên. Sau publish thành công, chỉ còn `META + PUBLISHED`.

### 5.2. Lưu trữ và xóa

Khi admin xóa:

- Nội dung chuyển sang trạng thái `DELETED`.
- Lambda ghi `deletedAt` và `purgeAt = deletedAt + 10 ngày`.
- Giữ metadata trong GSI cho danh sách quản lý thùng rác; các route reader loại DELETED sau khi đọc snapshot trạng thái mới nhất.
- Gán `purgeAt` cho `META`, `DRAFT` (nếu có) và `PUBLISHED` (nếu có).
- User không thể đọc nội dung đã xóa.
- Admin có thể restore trong 10 ngày.
- DynamoDB TTL xóa vật lý sau `purgeAt`; TTL là cơ chế bất đồng bộ nên không cam kết đúng từng phút.

Khi xóa một giáo lý viên, backend gỡ liên kết catechistId trên account trong cùng transaction, giữ Cognito account hoạt động. Restore profile không tự liên kết lại. Chỉ ACCOUNT DELETED hết TTL mới yêu cầu users-api xóa Cognito user.

## 6. Thiết kế DynamoDB

Tên bảng: `GiaoLyTable`.

### 6.1. Item giáo án

```text
PK = LESSON#<lessonId>
SK = META | DRAFT | PUBLISHED
```

- **META**: `lessonId`, `entityType`, `title`, `normalizedTitle`, `summary`, `level`, `sublevel`, `lessonNumber`, `durationMinutes`, `publicationStatus`, `version`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `publishedAt`, `publishedBy`, `deletedAt`, `purgeAt`.
- **DRAFT**: các rich-text field `keyPoints`, `sentiment`, `preparation`, `progression[].teacherActivity`, `progression[].learnerActivity`, `sections[].content` dưới dạng TipTap JSON map; `scriptureText`, `scriptureReference` và metadata dưới dạng string; `version`, `updatedAt`, `updatedBy`.
- **PUBLISHED**: cùng schema nội dung của DRAFT, cộng `publishedAt`, `publishedBy`.
- Image node chỉ lưu `mediaId`, `alt`, `width`, `alignment`; không lưu `src`, URL ký, base64 hoặc bytes ảnh.

### 6.2. Item chương trình

```text
PK = PROGRAM#<programId>
SK = META | DRAFT | PUBLISHED
```

- **META**: `programId`, title, description, level, sublevel, version, trạng thái và audit fields.
- **DRAFT/PUBLISHED**: thông tin chương trình, `scheduleColumns` riêng từng chương trình và mảng `schedule`.
- Mỗi row gồm `id`, `values` map từ `columnId` tới TipTap JSON document, và tùy chọn `mergedCellGroups` (mảng nhóm ID cột kề nhau). Ngày, tuần hoặc nội dung là cột do editor cấu hình; không hardcode schema cột chung.

### 6.3. Item giáo lý viên

```text
PK = CATECHIST#<catechistId>
SK = PROFILE
```

Trường chính: `catechistId`, `name`, `normalizedName`, `email`, `phone`, `group`, `status`, `createdAt`, `updatedAt`, `deletedAt`, `purgeAt`.

Hồ sơ không bắt buộc có account Cognito. Account Editor lưu `catechistId` để liên kết; Reader không có profile. Email không dùng làm primary key vì email có thể đổi.

### 6.4. Item account

```text
PK = ACCOUNT#<cognitoSub>
SK = PROFILE
```

Trường chính: `cognitoSub`, `email`, `role` (`ADMIN`, `EDITOR`, `READER`), `catechistId` (chỉ Editor), `accountStatus`, `createdAt`, `updatedAt`, `deletedAt`, `purgeAt`.

Không có password ở DynamoDB. Password chỉ do Cognito quản lý. Account lưu trữ bị disable ngay; khi TTL xóa item sau 10 ngày, DynamoDB Stream yêu cầu `users-api` xóa user Cognito tương ứng.

### 6.5. Item tài liệu tham khảo

```text
PK = REFERENCE#<referenceId>
SK = META | DRAFT | PUBLISHED
```

- **META**: `referenceId`, `entityType=REFERENCE`, `title`, `normalizedTitle`, `category` (`Sinh hoạt` hoặc `Kỹ năng`), `status` (`ACTIVE` hoặc `DELETED`), `hasDraft`, `hasPublished`, `version`, audit timestamps/users, `deletedAt`, `purgeAt`.
- **DRAFT/PUBLISHED**: `content` là TipTap JSON map, `version` và audit fields; PUBLISHED có thêm `publishedAt`, `publishedBy`.
- Publish ghi đè PUBLISHED từ DRAFT và xóa DRAFT trong một transaction. Tài liệu xóa mềm được giữ 10 ngày để restore, rồi TTL xóa các item liên quan.
- Category là enum cố định, không có CRUD category.

### 6.6. Item media ảnh giáo án

```text
PK = MEDIA#<mediaId>
SK = PROFILE
```

Metadata tối thiểu: `mediaId`, `lessonId`, `objectKey`, `mimeType`, `sizeBytes`, `uploadStatus` (`UPLOADING`/`ATTACHED`), `purgeAt` khi cần TTL. Bytes ảnh lưu trong prefix `lesson-media/` của cùng app bucket chứa frontend; item DynamoDB chỉ giữ metadata/tham chiếu. Upload chưa gắn vào nội dung hết hạn TTL sau 1 ngày. Khi ảnh không còn được tham chiếu trong cả DRAFT lẫn PUBLISHED, đặt TTL 10 ngày để hỗ trợ khôi phục/xóa theo vòng đời nội dung.

### 6.6.1. Một app bucket, tách prefix

Trong mỗi môi trường, dùng một app bucket cho cả static frontend và ảnh minh họa, phân vùng object bằng hai prefix:

```text
frontend/                         # build static Next.js, đọc qua CloudFront
lesson-media/<lessonId>/<mediaId> # ảnh private, PUT/GET qua presigned URL
```

App bucket phải bật Block Public Access, mã hóa phía server và không cấp public ACL. Đây là một bucket dùng chung nhưng không phải một quyền dùng chung: bucket policy chỉ cho CloudFront `s3:GetObject` trên `frontend/*`; IAM role của `content-api` chỉ được ký/đọc/ghi/xóa object cần thiết dưới `lesson-media/*`. Ảnh không được public qua S3 hoặc CloudFront; API chỉ cấp presigned URL sau khi kiểm tra quyền và quyền sở hữu media. Cấu hình S3 CORS ở cấp bucket chỉ cho origin dev/prod đã định, method `GET`/`PUT` cần thiết và header `Content-Type`; các rule lifecycle/notification bắt buộc lọc prefix `lesson-media/`.

Bucket Terraform state vẫn là bucket riêng, không chứa nội dung website hay ảnh. Dùng app bucket riêng cho `dev` và `prod` để cô lập dữ liệu/môi trường; mỗi bucket môi trường vẫn chỉ có hai prefix nội dung trên. Việc gộp app bucket giảm số resource phải quản lý, không làm giảm đáng kể hóa đơn vì phí S3 chủ yếu theo storage, request và data transfer.

### 6.7. GSI catalog

Dùng một GSI chỉ project các field metadata cần cho danh sách; không project TipTap JSON hoặc nội dung đầy đủ.

```text
Lesson:
GSI1PK = CATALOG#LESSON
GSI1SK = <lessonNumber>#<normalizedTitle>#<lessonId>

Program:
GSI1PK = CATALOG#PROGRAM
GSI1SK = <normalizedTitle>#<programId>

Catechist:
GSI1PK = DIRECTORY#CATECHIST
GSI1SK = <normalizedName>#<catechistId>

Account:
GSI1PK = DIRECTORY#ACCOUNT
GSI1SK = <normalizedEmail>#<cognitoSub>

Reference:
GSI1PK = CATALOG#REFERENCE#<category>
GSI1SK = <normalizedTitle>#<referenceId>
```

Với references, index giữ metadata ACTIVE và DELETED để editor/admin có thể liệt kê cả mục trong thùng rác; route reader áp dụng điều kiện `status=ACTIVE` và chỉ trả tài liệu có PUBLISHED. Với số lượng bài nhỏ, Lambda Query theo ngành/phân ngành/category và lọc prefix tiêu đề đã chuẩn hóa. Không dùng `Scan` cho danh sách và không cần OpenSearch.

### 6.8. Kích thước nội dung

DynamoDB giới hạn 400 KB trên một item. Nội dung được tách DRAFT/PUBLISHED nên mỗi item chỉ chứa một bản nội dung. Backend giới hạn tổng TipTap JSON serialized UTF-8 tối đa 200 KB trên mỗi revision sau khi validate schema, độ sâu và allowlist node/mark. Kích thước này không tính bytes ảnh vì ảnh ở S3.

Với bài dài 5–6 trang và tổng khoảng 800 trang, nội dung dự kiến chỉ ở quy mô vài chục MB. Danh sách chỉ đọc META; nội dung đầy đủ chỉ được đọc khi mở từng bài.

## 7. API contract v1

> **Nguồn chuẩn:** [api-contract-v1.md](api-contract-v1.md) là hợp đồng API hiện hành. Nội dung chi tiết 7.1–7.6 bên dưới được giữ lại như ghi chú lịch sử của thiết kế ban đầu (`admin/user`), không dùng để triển khai.

Mọi route yêu cầu access token hợp lệ. Route `/admin/*` yêu cầu claims chứa group `admin`.

### 7.1. Route đọc

```text
GET /lessons?level=&sublevel=&q=&lessonNumber=&cursor=&limit=
GET /lessons/{lessonId}
GET /programs?level=&sublevel=&q=&cursor=&limit=
GET /programs/{programId}
GET /catechists?cursor=&limit=
```

Các endpoint list trả metadata/tóm tắt; endpoint detail mới trả TipTap JSON hoặc schedule đầy đủ. API dùng cursor pagination, không dùng page number.

### 7.2. Route quản trị

```text
POST   /admin/lessons
PUT    /admin/lessons/{lessonId}/draft
POST   /admin/lessons/{lessonId}/publish
DELETE /admin/lessons/{lessonId}
POST   /admin/lessons/{lessonId}/restore

POST   /admin/programs
PUT    /admin/programs/{programId}/draft
POST   /admin/programs/{programId}/publish
DELETE /admin/programs/{programId}
POST   /admin/programs/{programId}/restore

POST   /admin/catechists
PUT    /admin/catechists/{cognitoSub}
POST   /admin/catechists/{cognitoSub}/reset-password
POST   /admin/catechists/{cognitoSub}/disable
POST   /admin/catechists/{cognitoSub}/enable
DELETE /admin/catechists/{cognitoSub}
POST   /admin/catechists/{cognitoSub}/restore

GET    /admin/trash?entityType=&cursor=&limit=
```

### 7.3. Payload giáo án

```json
{
  "title": "Chúa Giêsu yêu thương em",
  "summary": "Nhận biết tình yêu của Chúa Giêsu...",
  "keyPoints": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }] },
  "sentiment": { "type": "doc", "content": [{ "type": "paragraph" }] },
  "preparation": { "type": "doc", "content": [{ "type": "paragraph" }] },
  "progression": [{ "teacherActivity": { "type": "doc", "content": [] }, "learnerActivity": { "type": "doc", "content": [] } }],
  "sections": [{ "key": "I", "title": "Ổn định", "content": { "type": "doc", "content": [] } }],
  "scriptureText": "Hãy để trẻ em đến với Thầy...",
  "scriptureReference": "Mt 19,14",
  "level": "Ấu Nhi",
  "sublevel": "Ấu 1",
  "lessonNumber": 1,
  "durationMinutes": 45,
  "version": 3
}
```

### 7.4. Payload chương trình

```json
{
  "title": "Chương trình Ấu Nhi 1",
  "description": "Chương trình học hiện hành",
  "level": "Ấu Nhi",
  "sublevel": "Ấu 1",
  "schedule": [
    {
      "date": "2026-09-06",
      "weekNumber": 1,
      "topic": "Em là con yêu dấu của Chúa",
      "lessonContent": "Làm quen và nhận biết...",
      "activities": "Nghi thức chào cờ · Tập hát",
      "notes": "Chương trình Chúa nhật"
    }
  ],
  "version": 2
}
```

### 7.5. Payload tạo giáo lý viên

```json
{
  "name": "Maria Nguyễn Thị Lan",
  "email": "lan@example.com",
  "phone": "0901234567",
  "group": "Ấu Nhi",
  "status": "ACTIVE",
  "password": "mat-khau-do-admin-cap"
}
```

Backend tạo UUID cho content và lấy `cognitoSub` từ Cognito; frontend không tự tạo các ID này.

### 7.6. Quản lý tài khoản giáo lý viên trong admin

Admin quản lý tài khoản ngay trong khu vực danh bạ giáo lý viên; không cần truy cập AWS Console cho các thao tác thường ngày.

- Mỗi account mới tự động tạo một hồ sơ giáo lý viên tương ứng.
- Form tạo gồm họ tên, email, số điện thoại, nhóm, trạng thái, mật khẩu và xác nhận mật khẩu.
- Account mới mặc định thuộc Cognito group `user`; giao diện không hỗ trợ tạo hoặc nâng quyền `admin` ở giai đoạn đầu.
- Danh sách admin hiển thị họ tên, email, số điện thoại, nhóm, trạng thái account và ngày tạo.
- Admin có thể sửa hồ sơ, đặt lại mật khẩu, disable/enable, lưu trữ và khôi phục account.
- Hệ thống không hiển thị lại password sau khi tạo hoặc đặt lại.

Luồng tạo account:

```text
Admin gửi form
→ users-api validate input
→ Cognito tạo user và đặt permanent password
→ DynamoDB tạo USER#<cognitoSub> / PROFILE
→ trả hồ sơ đã tạo, không có password
```

Cognito và DynamoDB không có transaction dùng chung. Nếu tạo PROFILE thất bại sau khi Cognito đã tạo user, `users-api` phải thử xóa Cognito user vừa tạo như một compensating action. Nếu thao tác bù trừ cũng thất bại, Lambda ghi lỗi có request ID để admin hoặc người vận hành xử lý lại; password không được ghi log.

### 7.6. Response chuẩn

```json
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Nội dung đã được cập nhật bởi người khác.",
    "details": []
  },
  "meta": {
    "requestId": "..."
  }
}
```

Các error code đầu tiên: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VERSION_CONFLICT`, `CONTENT_TOO_LARGE`, `INTERNAL_ERROR`.

## 8. Validation và bảo mật

- Validate TipTap JSON theo schema, độ sâu và allowlist node/mark ở backend trước khi lưu/trả về; field rich-text API không được gọi `contentHtml`.
- Giới hạn tổng TipTap JSON serialized UTF-8 tối đa 200 KB trên mỗi revision.
- Chỉ chấp nhận category tham khảo cố định `Sinh hoạt`/`Kỹ năng`; reader chỉ truy vấn được ACTIVE/PUBLISHED.
- App bucket theo môi trường bật Block Public Access/mã hóa, không public ACL; CloudFront chỉ đọc prefix `frontend/`, content Lambda chỉ có quyền media tối thiểu trên `lesson-media/`.
- Chỉ editor/admin được xin URL upload hoặc đọc draft. Presigned PUT 5 phút, GET 15 phút; xác minh media thuộc đúng lesson và kiểm tra object thực tế bằng `HeadObject` trước khi lưu/publish.
- Chỉ nhận JPEG/PNG/WebP tối đa 5 MiB; từ chối SVG. CORS bucket chỉ cho origin frontend dev/prod và method/header cần thiết.
- Item MEDIA chưa gắn nội dung được TTL sau 1 ngày; media orphan được TTL sau 10 ngày. Bật DynamoDB Stream `NEW_AND_OLD_IMAGES`; event-source mapping từ stream hiện tại tới `content-api` xử lý REMOVE của MEDIA và xóa S3 object theo old image. Xử lý lặp an toàn; users-api vẫn chịu trách nhiệm riêng về account Cognito.
- Chuẩn hóa title và name để tạo field tìm kiếm không dấu/chữ thường.
- Validate `date` theo ISO 8601, `lessonNumber` và `durationMinutes` là số dương.
- Validate email và định dạng số điện thoại.
- Dùng optimistic concurrency: mọi request sửa/publish gửi `version`; backend dùng condition expression và trả HTTP 409 khi version không khớp.
- Không ghi password, JWT hay toàn bộ nội dung rich-text vào CloudWatch Logs.
- CORS chỉ cho phép domain CloudFront của dev/prod.
- API Gateway throttling bảo vệ API; Lambda/IAM theo nguyên tắc ít quyền nhất.
- Password phải đạt policy của Cognito. Admin cấp password cố định nhưng backend không bao giờ lưu mật khẩu trong DynamoDB.
- API tạo, đặt lại password, disable/enable và lưu trữ account chỉ cho group `admin`.
- Backend không trả password, Cognito secret, JWT hoặc thông tin xác thực trong bất kỳ API response nào.
- Không dùng SMS hoặc MFA ở giai đoạn đầu.
- Bật DynamoDB PITR ở production; dữ liệu nhỏ nhưng có giá trị lâu dài.

## 9. Cấu trúc source dự kiến

```text
Backend/
├── docs/
├── infrastructure/
│   ├── modules/
│   └── environments/
│       ├── dev/
│       └── prod/
├── src/
│   ├── content_api/
│   │   ├── handler.py
│   │   ├── router.py
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── validators/
│   ├── users_api/
│   │   ├── handler.py
│   │   ├── router.py
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── validators/
│   └── shared/
│       ├── auth.py
│       ├── responses.py
│       ├── errors.py
│       ├── tiptap_validator.py
│       └── models.py
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
```

Luồng xử lý mỗi request:

```text
API Gateway event
→ handler
→ router theo method + routeKey
→ controller: input và claims
→ validator
→ service: nghiệp vụ
→ repository: DynamoDB/Cognito
→ response JSON
```

## 10. Terraform và môi trường

Terraform sẽ dùng cấu trúc module dùng lại và hai môi trường có variables/state độc lập:

```text
infrastructure/
  modules/
    cognito/
    api_gateway/
    lambda/
    dynamodb/
    monitoring/
  environments/
    dev/
    prod/
```

Mỗi môi trường có resource name prefix riêng, ví dụ `giaoan-dev-*` và `giaoan-prod-*`, đồng thời có state backend riêng. Không dùng chung User Pool, API Gateway, Lambda hoặc DynamoDB table giữa dev/prod.

### 10.1. Terraform remote state

Terraform state lưu từ xa trên một S3 bucket dành riêng cho state, không commit `terraform.tfstate` vào Git và không dùng state local để deploy môi trường thật.

```text
s3://<terraform-state-bucket>/giaoan/dev/terraform.tfstate
s3://<terraform-state-bucket>/giaoan/prod/terraform.tfstate
```

S3 bucket state phải có:

- Block Public Access.
- Bucket Versioning để khôi phục state khi có thao tác nhầm.
- Server-side encryption (SSE-S3 hoặc KMS tùy chính sách triển khai).
- IAM policy chỉ cho người/role triển khai Terraform đọc-ghi đúng prefix môi trường.
- S3 state locking bằng `use_lockfile = true`; Terraform tạo file `.tflock` cạnh state trong lúc `plan`/`apply` ghi state.

Không tạo DynamoDB table riêng để lock Terraform state. HashiCorp hiện đánh dấu cơ chế DynamoDB-based locking là deprecated; S3 lockfile là phương án dùng cho thiết kế mới.

Terraform quản lý:

- Một app bucket cho mỗi môi trường, chứa prefix `frontend/` và `lesson-media/`; CloudFront OAC chỉ đọc `frontend/*`, content Lambda IAM chỉ thao tác `lesson-media/*`.
- Cognito User Pool, app client, password policy, groups.
- Hai HTTP API, hai JWT Authorizer, routes, CORS, custom domain và throttling riêng.
- Hai Lambda và IAM roles.
- DynamoDB, GSI, TTL, Stream, PITR production.
- CloudWatch log group và retention.
- Alarm Lambda errors/throttles.
- AWS Budget cảnh báo chi phí.

## 11. Testing và tiêu chí hoàn thành sau này

Thứ tự tự triển khai và các cổng kiểm tra theo từng giai đoạn được ghi tại [backend-implementation-plan.md](backend-implementation-plan.md); tài liệu này vẫn là thiết kế kiến trúc/DB nền tảng.

Khi bắt đầu code, tối thiểu cần có:

- Unit test router, validator và service không cần AWS.
- Repository test với DynamoDB test table hoặc giả lập.
- Integration test API Gateway payload v2.
- Contract test giữa payload Python và TypeScript frontend.
- Test publish transaction.
- Test version conflict.
- Test admin/user authorization.
- Test soft delete, restore và TTL Stream cleanup logic.
- Test TipTap JSON có node/mark không thuộc allowlist, depth quá lớn, URL ảnh do client tự chèn, media ID thuộc bài khác và nội dung vượt giới hạn đều bị từ chối.

## 12. Ước tính chi phí Singapore

Với khoảng 120 người dùng, nội dung khoảng 800 trang, khoảng 20.000 lượt đọc/tháng và rất ít lượt ghi:

| Hạng mục | Ước tính USD/tháng |
|---|---:|
| Cognito Lite/Essentials | $0 |
| DynamoDB reads/writes/storage | $0,05–$0,10 |
| Hai API Gateway HTTP API (tính theo tổng request) | khoảng $0,02 |
| Lambda | $0,03–$0,07 |
| S3 frontend | dưới $0,05 |
| CloudFront | $0,12–$0,60 |
| CloudWatch | $0,05–$0,30 |
| Route 53 hosted zone | khoảng $0,50 |
| Tổng | khoảng $0,82–$1,59 |

Chưa bao gồm domain, thuế, WAF hoặc dịch vụ gửi email/SMS có tính phí. Chi phí DynamoDB thấp do On-Demand chỉ tính RRU/WRU và dung lượng thực tế; nội dung có kích thước nhỏ và gần như chỉ đọc.

Nguồn tham khảo:

- [DynamoDB Pricing](https://aws.amazon.com/vi/dynamodb/pricing/)
- [API Gateway Pricing](https://aws.amazon.com/api-gateway/pricing/)
- [Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [Cognito Pricing](https://aws.amazon.com/cognito/pricing/)

