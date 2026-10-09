# API Contract v1

> Hợp đồng API của backend Python. Code và kiểm thử offline đã triển khai; triển khai/tích hợp AWS thực tế cần thực hiện theo runbook.

## 1. Nguyên tắc chung

- Base URL theo môi trường: `https://content-api-dev.<domain>` / `https://content-api.<domain>` và `https://users-api-dev.<domain>` / `https://users-api.<domain>`.
- Body request/response là JSON UTF-8. Rich text trao đổi dưới dạng TipTap JSON document; không dùng field `contentHtml` hoặc lưu HTML làm định dạng chuẩn.
- Frontend đăng nhập trực tiếp với Cognito. Sau khi đăng nhập, gửi access token trong header `Authorization: Bearer <access-token>`.
- Gateway tương ứng kiểm tra JWT trước khi gọi Lambda tương ứng. Lambda vẫn kiểm tra group và `sub` trong claims trước mọi thao tác ghi.
- Frontend không gửi `createdBy`, `updatedBy`, `publishedBy`, `version` mới, ID Cognito hay quyền. Backend tự lấy chúng từ claims hoặc tự sinh.
- Mọi response đều có `meta.requestId`. Response không bao giờ chứa password, JWT hoặc Cognito client secret.

```json
{ "data": {}, "meta": { "requestId": "uuid" } }
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu gửi lên chưa hợp lệ.",
    "details": [{ "field": "title", "message": "Không được để trống." }]
  },
  "meta": { "requestId": "uuid" }
}
```

## 2. Vai trò và quyền

| Vai trò Cognito group | Đọc nội dung/danh bạ | Quản lý giáo án, chương trình, danh bạ | Quản lý tài khoản |
|---|---:|---:|---:|
| `reader` | Có | Không | Không |
| `editor` | Có | Có | Không |
| `admin` | Có | Có | Có |

`reader` là một tài khoản dùng chung cho các anh chị chỉ cần xem. `editor` không tạo hoặc quản lý account; họ có thể tạo, sửa, xóa mọi hồ sơ giáo lý viên. `admin` là tài khoản duy nhất có thể gọi route `/admin/accounts/*`.

## 3. Quy ước dữ liệu

### 3.1. Giáo án

```json
{
  "title": "Chúa Giêsu yêu thương em",
  "summary": "Nhận biết tình yêu của Chúa Giêsu qua những câu chuyện gần gũi.",
  "keyPoints": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }] },
  "sentiment": { "type": "doc", "content": [{ "type": "paragraph" }] },
  "preparation": { "type": "doc", "content": [{ "type": "paragraph" }] },
  "progression": [{ "teacherActivity": { "type": "doc", "content": [] }, "learnerActivity": { "type": "doc", "content": [] } }],
  "sections": [{ "key": "I", "title": "Ổn định", "content": { "type": "doc", "content": [] } }],
  "scriptureText": "Hãy để trẻ em đến với Thầy, đừng ngăn cấm chúng.",
  "scriptureReference": "Mt 19,14",
  "level": "Ấu Nhi",
  "sublevel": "Ấu 1",
  "lessonNumber": 1,
  "durationMinutes": 45,
  "version": 3
}
```

Các rich-text field (`keyPoints`, `sentiment`, `preparation`, hoạt động trong `progression` và `sections[].content`) là TipTap JSON object. Backend validate schema, độ sâu, node/mark allowlist và tổng UTF-8 serialized size; tổng rich-text của một revision không quá 200 KB. Field văn bản thuần như `title`, `summary`, `scriptureText`, `scriptureReference`, `level`, `sublevel` vẫn là string. `version` là phiên bản hiện đang đọc và bắt buộc khi cập nhật/publish để chống ghi đè đồng thời. Không chấp nhận URL ký hạn hoặc `src` do client gửi như dữ liệu bền vững.

Ảnh trong giáo án là image node TipTap chứa `mediaId`, `alt`, `width` và `alignment`; URL `src` chỉ được backend thêm tạm vào response sau kiểm tra quyền. Không lưu bytes, base64 hoặc URL ký vào DynamoDB.

Khi trả chi tiết bài giáo án đã xuất bản, API chỉ thêm presigned GET URL (hạn 15 phút) vào `attrs.src` của image node được PUBLISHED revision tham chiếu. Route đọc bản nháp chỉ dành cho editor/admin và chỉ ký URL cho ảnh đang được bản nháp của đúng bài tham chiếu. Frontend không gửi lại URL này khi lưu.

### 3.4. Tài liệu tham khảo

```json
{
  "title": "Trò chơi sinh hoạt mẫu",
  "category": "Sinh hoạt",
  "content": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }] },
  "version": 1
}
```

`category` chỉ nhận `Sinh hoạt` hoặc `Kỹ năng`. `content` là TipTap JSON, có giới hạn 200 KB sau khi serialize. Tài liệu chỉ có bản PUBLISHED mới được trả cho reader.

### 3.2. Chương trình học

```json
{
  "title": "Chương trình Ấu Nhi 1",
  "description": "Chương trình học hiện hành",
  "level": "Ấu Nhi",
  "sublevel": "Ấu 1",
  "scheduleColumns": [{ "id": "date", "label": "Ngày" }, { "id": "content", "label": "Nội dung" }],
  "schedule": [{
    "id": "row_01J...",
    "values": {
      "date": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "2026-09-06" }] }] },
      "content": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Em là con yêu dấu của Chúa" }] }] }
    },
    "mergedCellGroups": []
  }],
  "version": 2
}
```

Mỗi chương trình tự định nghĩa `scheduleColumns`; không dùng bộ cột toàn cục. Mỗi `schedule[].values[columnId]` là TipTap JSON document (các ô được gộp lưu trong `mergedCellGroups`, không xóa giá trị cột gốc khác khi cập nhật cấu trúc bảng). Khi trao đổi qua API, gửi JSON object, không gửi chuỗi JSON/HTML.

### 3.3. Hồ sơ giáo lý viên

```json
{
  "name": "Maria Nguyễn Thị Lan",
  "email": "lan@example.com",
  "phone": "0901234567",
  "group": "Ấu Nhi",
  "status": "ACTIVE",
  "version": 1
}
```

`status` nhận `ACTIVE`, `PAUSED`, `INACTIVE`. Hồ sơ có `catechistId` do backend sinh; không dùng Cognito `sub` làm ID vì reader không có hồ sơ, còn account Editor chỉ liên kết với hồ sơ.

## 4. Route đọc — mọi vai trò đã đăng nhập

| Method & path | Query / body | Kết quả |
|---|---|---|
| `GET /lessons` | `level`, `sublevel`, `q`, `lessonNumber`, `cursor`, `limit` | Danh sách META đã xuất bản |
| `GET /lessons/{lessonId}` | — | Nội dung PUBLISHED đầy đủ |
| `GET /programs` | `level`, `sublevel`, `q`, `cursor`, `limit` | Danh sách chương trình hiện hành |
| `GET /programs/{programId}` | — | Schedule PUBLISHED đầy đủ |
| `GET /catechists` | `q`, `cursor`, `limit` | Danh bạ giáo lý viên chưa bị xóa |
| `GET /references` | `category`, `q`, `cursor`, `limit` | Danh sách metadata tài liệu PUBLISHED theo đúng category; không trả draft hoặc tài liệu đã xóa |
| `GET /references/{referenceId}` | — | Tài liệu PUBLISHED đầy đủ; không trả URL media draft |

`limit` mặc định 20, tối đa 50. List response trả `meta.nextCursor` khi còn trang kế tiếp. `q` tìm theo title/tên đã chuẩn hóa, không phải full-text search.

## 5. Route quản lý nội dung — `admin`, `editor`

| Method & path | Body chính | Ghi chú |
|---|---|---|
| `GET /manage/lessons` | query `level`, `sublevel`, `lessonNumber`, `q`, `cursor`, `limit`, `includeDeleted` | Metadata draft/published; gồm thùng rác khi `includeDeleted=true` |
| `GET /manage/programs` | query `level`, `sublevel`, `q`, `cursor`, `limit`, `includeDeleted` | Metadata draft/published; gồm thùng rác khi `includeDeleted=true` |
| `GET /manage/programs/{programId}` | — | Đọc draft nếu có, nếu không published; trả META version để tiếp tục sửa sau reload |
| `GET /manage/catechists` | query `q`, `cursor`, `limit`, `includeDeleted` | Danh bạ quản lý và hồ sơ đã lưu trữ còn trong thời gian khôi phục |
| `POST /manage/lessons` | payload giáo án, không cần `version` | Tạo META + DRAFT, chưa xuất bản |
| `PUT /manage/lessons/{lessonId}/draft` | payload giáo án + `version` | Chỉ ghi DRAFT |
| `POST /manage/lessons/{lessonId}/publish` | `{ "version": 3 }` | Transaction: PUBLISHED, META, xóa DRAFT |
| `DELETE /manage/lessons/{lessonId}` | — | Soft-delete 10 ngày |
| `POST /manage/lessons/{lessonId}/restore` | — | Khôi phục trong 10 ngày |
| `POST /manage/programs` | payload chương trình, không cần `version` | Tạo DRAFT |
| `PUT /manage/programs/{programId}/draft` | payload chương trình + `version` | Chỉ ghi DRAFT |
| `POST /manage/programs/{programId}/publish` | `{ "version": 2 }` | Ghi đè chương trình hiện hành, xóa DRAFT |
| `DELETE /manage/programs/{programId}` | — | Soft-delete 10 ngày |
| `POST /manage/programs/{programId}/restore` | — | Khôi phục trong 10 ngày |
| `POST /manage/catechists` | payload hồ sơ | Tạo profile độc lập với account |
| `PUT /manage/catechists/{catechistId}` | payload hồ sơ + `version` | Cập nhật profile |
| `DELETE /manage/catechists/{catechistId}` | — | Soft-delete 10 ngày |
| `POST /manage/catechists/{catechistId}/restore` | — | Khôi phục trong 10 ngày |
| `GET /manage/references` | `category`, `q`, `cursor`, `limit`, `includeDeleted` | Metadata; có thể gồm DRAFT-only và DELETED khi `includeDeleted=true` |
| `GET /manage/references/{referenceId}` | — | Chi tiết quản lý; trả draft nếu có, nếu không thì bản published |
| `GET /manage/lessons/{lessonId}` | — | Chi tiết quản lý; trả draft nếu có, nếu không thì bản published và ký URL chỉ cho ảnh thuộc revision được trả |
| `POST /manage/references` | payload tài liệu tham khảo | Tạo META + DRAFT |
| `PUT /manage/references/{referenceId}/draft` | payload + `version` | Lưu DRAFT |
| `POST /manage/references/{referenceId}/publish` | `{ "version": 1 }` | Ghi PUBLISHED, cập nhật META và xóa DRAFT trong transaction |
| `DELETE /manage/references/{referenceId}` | — | Soft-delete trong 10 ngày |
| `POST /manage/references/{referenceId}/restore` | — | Khôi phục trong 10 ngày |
| `POST /manage/lessons/{lessonId}/media-upload-url` | `{ "mimeType": "image/jpeg", "sizeBytes": 12345 }` | Cấp mediaId, presigned PUT URL 5 phút và required headers cho editor/admin |

`includeDeleted` bị bỏ qua hoặc từ chối nếu caller không phải `editor`/`admin`. Danh sách reader chỉ chứa metadata của tài liệu ACTIVE có PUBLISHED revision; không để lộ draft qua kết quả tìm kiếm hoặc số lượng theo category.

Các route quản lý bổ sung cho phép mở lại draft và tìm ID trong thùng rác sau reload. Metadata đã xóa vẫn ở GSI; route đọc công khai kiểm tra trạng thái mới nhất trước khi trả dữ liệu. Access token đã có cũng bị từ chối ngay khi ACCOUNT bị disable/archive; sau enable/restore cần token có `iat` mới hơn thời điểm thu hồi. Tài khoản phải có record ACCOUNT do API hoặc script tạo admin cấp.

`POST /manage/lessons` tạo lesson ID ở backend và trả `data.lessonId` cùng revision/version ban đầu. Khi tạo bài mới có ảnh, frontend phải tạo/lưu draft ban đầu để nhận ID này rồi mới xin URL upload; không dùng ID tạm tự sinh ở browser làm `lessonId` API.

Yêu cầu ký URL upload chỉ khai báo MIME và kích thước file; client không được tự chọn S3 object key. Response:

```json
{
  "data": {
    "mediaId": "media_01J...",
    "uploadUrl": "https://presigned-s3-url...",
    "requiredHeaders": { "Content-Type": "image/jpeg" },
    "expiresInSeconds": 300
  },
  "meta": { "requestId": "uuid" }
}
```

Browser PUT trực tiếp bytes lên `uploadUrl` cùng `requiredHeaders`. Trước khi lưu draft/publish, content Lambda kiểm tra object bằng `HeadObject`, đối chiếu lesson, MIME và byte size thực tế; chỉ sau đó mới đánh dấu MEDIA `ATTACHED`. Chỉ nhận `image/jpeg`, `image/png`, `image/webp` và không quá 5 MiB. Backend không tin MIME/size chỉ dựa trên request xin URL.

Object ảnh có key do backend tạo dưới prefix `lesson-media/` trong app bucket của đúng môi trường. Prefix ảnh không public và không thuộc quyền đọc của CloudFront; chỉ content-api Lambda được cấp IAM access cần thiết, còn browser truy cập object bằng presigned URL có hạn.

Khi `version` không khớp, trả `409 VERSION_CONFLICT` cùng metadata phiên bản hiện tại. Các route xóa chỉ ẩn dữ liệu ngay, DynamoDB TTL xử lý xóa vật lý sau 10 ngày.

## 6. Route tài khoản — chỉ `admin`

| Method & path | Body chính | Kết quả |
|---|---|---|
| `GET /admin/accounts` | `q`, `role`, `status`, `cursor`, `limit` | Danh sách account, không password |
| `POST /admin/accounts` | email, password, role, `catechistId?` | Tạo Cognito account + record ACCOUNT |
| `PUT /admin/accounts/{cognitoSub}/catechist-link` | `{ "catechistId": "..." }` | Đổi profile liên kết của Editor |
| `POST /admin/accounts/{cognitoSub}/reset-password` | `{ "password": "..." }` | Đặt permanent password bằng Cognito |
| `POST /admin/accounts/{cognitoSub}/disable` | — | Disable Cognito user |
| `POST /admin/accounts/{cognitoSub}/enable` | — | Enable Cognito user |
| `DELETE /admin/accounts/{cognitoSub}` | — | Lưu trữ 10 ngày, disable ngay |
| `POST /admin/accounts/{cognitoSub}/restore` | — | Khôi phục trong 10 ngày |

Payload tạo account:

```json
{
  "email": "lan.nguyen@giaoxuthaian.vn",
  "password": "mat-khau-do-admin-cap",
  "role": "EDITOR",
  "catechistId": "cat_01J..."
}
```

- Chỉ nhận `EDITOR` hoặc `READER`; không tạo/nâng quyền `ADMIN` từ UI/API ở giai đoạn đầu.
- `EDITOR` bắt buộc có `catechistId` hợp lệ. `READER` không có profile và là tài khoản dùng chung.
- Account mới **không tự tạo profile**. Admin tạo account sau khi có profile, đúng với UI hiện tại.
- Nếu editor xóa một profile đang liên kết, backend xóa liên kết trên account; account vẫn tồn tại nhưng Admin cần liên kết lại trước khi dùng thông tin hồ sơ.
- Không được xóa/lưu trữ Admin duy nhất; backend trả `409 LAST_ADMIN_PROTECTED`.

Luồng tạo: validate body → tạo Cognito user (không gửi email tự động) → đặt permanent password → tạo record DynamoDB `ACCOUNT`. Nếu bước DynamoDB thất bại, Lambda thử xóa user Cognito vừa tạo. Password chỉ tồn tại trong memory của request, tuyệt đối không log.

## 7. Mã lỗi chuẩn

| HTTP | Code | Khi nào |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Thiếu/sai định dạng field |
| 401 | `UNAUTHORIZED` | Thiếu hoặc JWT không hợp lệ |
| 403 | `FORBIDDEN` | Không thuộc role cần thiết |
| 404 | `NOT_FOUND` | ID không tồn tại hoặc đã purge |
| 409 | `VERSION_CONFLICT` | Có người khác đã cập nhật |
| 409 | `EMAIL_ALREADY_EXISTS` | Email đã có trong Cognito |
| 409 | `LAST_ADMIN_PROTECTED` | Cố disable/archive Admin cuối cùng |
| 413 | `CONTENT_TOO_LARGE` | TipTap JSON sau serialize vượt 200 KB |
| 500 | `INTERNAL_ERROR` | Lỗi không dự kiến; trả request ID để tra log |

## 8. Trạng thái frontend và việc cần làm khi tích hợp API thật

Frontend hiện đã có các trang đọc/chỉnh sửa, danh bạ, quản lý tài khoản, thư viện tham khảo và luồng chọn/tải ảnh ở mức giao diện/client; dữ liệu và vai trò vẫn là mock/in-memory, chưa nối Cognito hoặc hai API thật. Hoàn tất các việc sau trong giai đoạn tích hợp, sau khi API dev sẵn sàng:

1. Viết adapter/client cho hai base URL content/users; thay dữ liệu mẫu bằng request API, không gọi AWS SDK hay Cognito Admin API từ browser.
2. Nối đăng nhập Cognito, lấy access token và gắn `Authorization` cho mọi request API.
3. Ánh xạ kiểu dữ liệu frontend sang contract: rich text được lưu cục bộ dưới dạng chuỗi JSON TipTap (một số section còn tên legacy `contentHtml`) và program schedule cells là map string; API nhận TipTap JSON object. Chuẩn hóa serialize/deserialize tại ranh giới API; không gửi URL `src` ký hạn hay blob ảnh trong document.
4. Sau khi tạo lesson draft qua API và nhận `lessonId`, mới gọi endpoint xin URL upload; PUT trực tiếp object tới prefix media qua presigned URL.
5. Giữ `version` từ response detail; gửi lại khi lưu draft/publish/profile để xử lý xung đột.
6. Với lỗi `401`, đưa người dùng về đăng nhập; `403` hiển thị thông báo quyền; `409 VERSION_CONFLICT` yêu cầu tải lại dữ liệu.
7. Không lưu password sau khi submit form cấp/đặt lại tài khoản.
