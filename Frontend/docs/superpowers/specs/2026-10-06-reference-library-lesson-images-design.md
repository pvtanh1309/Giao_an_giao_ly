# Thiết kế thư viện tài liệu tham khảo và ảnh trong giáo án

## Mục tiêu

Mở rộng trang Giáo án với thư viện tài liệu tham khảo đọc trực tiếp trên website, đồng thời cho editor/admin chèn ảnh minh họa nhỏ vào nội dung rich text của giáo án. Ảnh có thể được phóng lớn khi người đọc chọn. Thiết kế phải phù hợp frontend tĩnh S3 + CloudFront, content API/Lambda, Cognito và DynamoDB đã chọn; không đưa nội dung nháp hoặc ảnh nháp ra quyền đọc thông thường.

## Bối cảnh và ràng buộc

- Trang Giáo án hiện có năm ngành, trang đọc riêng và editor TipTap dùng chung cho nội dung có cấu trúc.
- Frontend hiện serialize từng rich-text field thành TipTap JSON, dù hợp đồng API v1 đang ghi `contentHtml`. Backend chưa được viết; đây là thời điểm phù hợp để thống nhất hợp đồng trước khi triển khai.
- DynamoDB giới hạn 400 KB mỗi item; thiết kế hiện giới hạn phần nội dung tối đa 200 KB và chưa hỗ trợ upload ảnh/tệp.
- Hệ thống chỉ có hai HTTP API Gateway và hai Lambda: `content-api` xử lý giáo án/chương trình; `users-api` xử lý danh bạ/tài khoản. Người dùng đã chọn tự viết Terraform và backend Python; tài liệu này chỉ định nghĩa yêu cầu, giao diện và hợp đồng cần có, không sinh mã Terraform/Lambda.

## 1. Thư viện tài liệu tham khảo

- Trang Giáo án có thêm một thẻ thư viện độc lập bên cạnh năm thẻ ngành.
- Thư viện có hai nhóm cố định: `Sinh hoạt` và `Kỹ năng`; không có màn hình CRUD nhóm ở phiên bản đầu.
- Mỗi tài liệu gồm ID, tiêu đề, nhóm, nội dung TipTap JSON, trạng thái xuất bản, version và audit timestamps/users.
- Danh sách lọc theo nhóm và tìm theo tiêu đề. Chọn tài liệu mở trang đọc riêng theo mẫu trang đọc giáo án. Người đọc thường chỉ nhận bản xuất bản.
- Editor/admin có thể tạo/sửa, lưu bản nháp, xuất bản và xóa/khôi phục theo chính sách 10 ngày hiện dùng. Khi xuất bản, lưu bản published hiện hành và xóa draft; không lưu lịch sử phiên bản.
- Hai nhóm dùng cùng content API/Lambda và DynamoDB; không tạo Gateway, Lambda hoặc bảng mới.
- Nội dung tham khảo là rich text trực tiếp trên website. Chức năng chèn ảnh trong phạm vi này chỉ áp dụng cho giáo án; không mở rộng sang tài liệu tham khảo.

## 2. Định dạng nội dung chuẩn

TipTap JSON là định dạng chuẩn giữa trình duyệt, API và DynamoDB cho rich-text content. API nhận/trả JSON document có cấu trúc; không đặt tên field `contentHtml` cho dữ liệu JSON và không chuyển qua HTML làm định dạng lưu trữ chuẩn. Các field văn bản thuần như lời Chúa, trích dẫn, metadata vẫn là string.

Với giáo án, cấu trúc phần nội dung tiếp tục tương ứng UI hiện có: `keyPoints`, `sentiment`, `preparation`, `progression` (teacher/learner activities) và `sections` I–V; mỗi rich-text field là một TipTap document. Tài liệu tham khảo có một TipTap document `content`. Tổng kích thước UTF-8 đã serialize của tất cả TipTap documents trong một item DRAFT hoặc PUBLISHED không vượt 200 KB, không tính byte ảnh. Backend phải kiểm tra schema/độ sâu/kích thước và allowlist node/mark; TipTap JSON không được coi là an toàn chỉ vì không phải HTML.

## 3. Chèn và hiển thị ảnh

- Thanh công cụ editor có nút “Chèn ảnh”, mở bộ chọn file và chèn ảnh tại vị trí con trỏ trong rich-text fields của giáo án.
- Phiên bản đầu nhận JPEG, PNG và WebP; từ chối SVG và định dạng không hỗ trợ. Giới hạn file tải lên là 5 MB. Trình duyệt tối ưu ảnh xuống tối đa 1600 px cạnh dài trước upload khi có thể; backend xác thực loại/kích thước object thực sau upload.
- Ảnh mặc định rộng khoảng 220 px; editor có thể chọn cỡ nhỏ/vừa/lớn (khoảng 140/220/320 px), nhưng ảnh luôn co lại tối đa bằng bề rộng vùng nội dung. Lưu `alt`, chiều rộng và căn lề cùng image node.
- Người đọc thấy ảnh inline; bấm/chạm ảnh mở lightbox phóng lớn, có nút đóng, đóng bằng Escape và điều khiển bàn phím phù hợp. Kích thước trong lightbox không vượt viewport.
- TipTap JSON lưu ID media ổn định (`mediaId`), không lưu data URL, byte ảnh hay URL ký có thời hạn. Khi đọc, response được API bổ sung `src` tạm cho image node; frontend bỏ `src` runtime trước khi gửi lưu.

Mẫu node:

```json
{
  "type": "image",
  "attrs": {
    "mediaId": "media_ulid",
    "alt": "Minh họa câu chuyện",
    "width": 220,
    "alignment": "center"
  }
}
```

## 4. Lưu trữ và luồng API ảnh

- Tạo một bucket S3 riêng cho ảnh giáo án; bucket private, Block Public Access bật và mã hóa phía server bật. Bucket ảnh tách khỏi bucket frontend và bucket Terraform state.
- Người dùng editor/admin đã xác thực gọi `content-api` để xin presigned PUT URL có thời hạn ngắn. Content Lambda kiểm tra role, lesson ID, MIME và giới hạn byte, sinh `mediaId`/object key ngẫu nhiên, rồi cấp URL chỉ dùng cho object đó. Trình duyệt PUT trực tiếp lên S3; ảnh không đi qua API Gateway/Lambda.
- Khi lưu draft hoặc xuất bản, API xác thực mọi `mediaId` được tham chiếu thuộc bài đó, đã upload hoàn tất và đúng loại/kích thước. API lưu document TipTap cùng danh sách media IDs; byte ảnh không ghi DynamoDB.
- Khi đọc bản PUBLISHED, content API tạo URL GET ký ngắn hạn chỉ cho media IDs thực sự được bài published tham chiếu. Khi editor/admin đọc DRAFT, API chỉ cấp URL sau khi quyền được kiểm tra. Không trả URL ảnh của draft cho reader.
- Quyền bucket và IAM role chỉ cấp hành động cần thiết trên prefix ảnh. CORS chỉ cho phép origin frontend theo môi trường và phương thức cần thiết (PUT/GET/HEAD nếu dùng). Không cấp credential AWS cho browser.
- Metadata media tối thiểu gồm mediaId, lessonId, S3 key, MIME, byte size, trạng thái upload/liên kết và `purgeAt`. Metadata dùng chung `GiaoLyTable`; không cần DynamoDB table mới. Item ở trạng thái `UPLOADING` nhận TTL một ngày; khi draft được lưu thành công, item được đánh dấu `ATTACHED` và TTL bị gỡ. Khi media không còn được tham chiếu bởi DRAFT lẫn PUBLISHED, backend đặt TTL 10 ngày. Khôi phục trong thời hạn này gỡ TTL nếu bài tham chiếu lại media.
- Bật DynamoDB Stream với `NEW_AND_OLD_IMAGES` trên `GiaoLyTable` (đã cần cho xóa account Cognito). Thêm event-source mapping từ stream hiện có đến `content-api` Lambda; khi nhận REMOVE item `MEDIA` do TTL, Lambda xóa object S3 theo key trong old image. `users-api` tiếp tục xử lý các item account như thiết kế cũ. Không thêm Lambda thứ ba. Route xóa/khôi phục lesson cập nhật trạng thái/TTL của media tương ứng để ảnh có thể khôi phục cùng bài trong 10 ngày.

## 5. API/data contract dự kiến

Thêm routes vào content API hiện tại:

```text
GET    /references?category=&q=&cursor=&limit=
GET    /references/{referenceId}
GET    /manage/references?category=&q=&cursor=&limit=
GET    /manage/references/{referenceId}
POST   /manage/references
PUT    /manage/references/{referenceId}/draft
POST   /manage/references/{referenceId}/publish
DELETE /manage/references/{referenceId}
POST   /manage/references/{referenceId}/restore

POST   /manage/lessons/{lessonId}/media-upload-url
GET    /manage/lessons/{lessonId}      # bản nháp hiện tại cho editor/admin
```

Upload URL request bao gồm MIME type và kích thước byte; response trả `mediaId`, `uploadUrl`, required headers và thời gian hết hạn (5 phút). Trình duyệt PUT object lên S3; khi draft được lưu, content Lambda gọi `HeadObject` để xác nhận object tồn tại, MIME/kích thước khớp và thuộc đúng lesson. Không cần route completion riêng. Khi ghi TipTap JSON, backend chỉ lưu `mediaId`, `alt`, `width` và `alignment`; loại bỏ `src` gửi từ client. Khi đọc, API thêm URL GET đã ký có thời hạn 15 phút cho từng image node được phép trả.

DynamoDB dùng cùng `GiaoLyTable`:

```text
PK = REFERENCE#<referenceId>
SK = META | DRAFT | PUBLISHED
PK = MEDIA#<mediaId>
SK = PROFILE
lessonId = <lessonId>
objectKey = lesson-media/<lessonId>/<mediaId>
```

GSI catalog tham chiếu partition theo category cố định, sort theo normalized title; không project document đầy đủ. `referenceId` dùng ID ổn định. Draft/published tuân thủ cùng chính sách version, soft-delete, restore và xóa draft khi publish.

## 6. Quyền và xử lý lỗi

- Cognito JWT Authorizer xác thực mọi route; content Lambda xác thực group cho mọi thao tác ghi/upload.
- `reader`, `editor`, `admin` đọc references và bài published. Chỉ `editor`/`admin` được quản lý references, lesson draft và upload ảnh.
- API từ chối mediaId không tồn tại, sai lesson, chưa upload xong, MIME/kích thước không hợp lệ hoặc ảnh không nằm trong nội dung được cấp quyền; trả lỗi chuẩn `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `CONTENT_TOO_LARGE`/`UPLOAD_TOO_LARGE`.
- Nếu upload thất bại, editor thấy thông báo có thể thử lại; không chèn node ảnh hỏng vào document. Nếu URL xem ảnh hết hạn, frontend tải lại nội dung/URL có quyền thay vì giữ URL ký trong dữ liệu lâu dài.

## 7. Phạm vi không bao gồm

- Viết mã Lambda, Terraform hoặc cấu hình AWS có thể triển khai; người dùng muốn tự viết backend/Terraform.
- Upload tài liệu tham khảo, PDF, video, SVG hoặc ảnh cho chương trình học.
- Tạo nhóm tài liệu tùy biến; hai nhóm phiên bản đầu là cố định.
- Lịch sử nhiều phiên bản, chỉnh ảnh (crop/rotate) hoặc thư viện media dùng chung độc lập.

## Tiêu chí chấp nhận

1. Trang Giáo án hiển thị thư viện riêng bên cạnh năm ngành; chọn Sinh hoạt/Kỹ năng chỉ thấy tài liệu thuộc nhóm tương ứng.
2. Tài liệu có thể được tạo, sửa, lưu draft, publish, xóa/khôi phục bởi editor/admin; reader không nhìn thấy draft.
3. Từng rich-text field của giáo án giữ đúng định dạng TipTap sau lưu/đọc; ảnh chèn xuất hiện đúng vị trí và không làm hỏng thao tác sửa/xuất bản.
4. Upload bị từ chối nếu loại/size không hợp lệ; ảnh được lưu trong S3 private và payload DynamoDB chỉ chứa tham chiếu.
5. Reader chỉ xem URL ký của ảnh gắn với bài đã xuất bản; ảnh draft không được trả cho reader.
6. Ảnh inline nhỏ, đáp ứng mobile; chạm ảnh mở lightbox, đóng được bằng Escape/nút đóng.
7. Build tĩnh của Next.js tiếp tục hoạt động; không thêm route dynamic phụ thuộc SSR.

## Rủi ro và quyết định tích hợp

- API contract v1 hiện chưa khớp dữ liệu frontend thực tế (`contentHtml` so với TipTap JSON). Cập nhật contract trước khi viết code backend; không triển khai migration dữ liệu vì backend/database chưa được tạo.
- DynamoDB TTL xóa không đúng từng phút; xử lý stream phải idempotent, có retry/DLQ và cảnh báo lỗi để không làm mất đồng bộ giữa metadata với object S3.
- S3 CORS chỉ cho origin frontend dev/prod đã cấu hình; URL ký ngắn hạn, không bật public-read để tiện hiển thị.
- Frontend static không thể tự đảm bảo quyền; mọi kiểm tra quyền, quan hệ media–lesson và trạng thái xuất bản phải được enforce tại content API.
