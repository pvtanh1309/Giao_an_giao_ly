# Thiết kế trang đọc giáo án và chương trình học

## Mục tiêu

Thay hộp thoại chi tiết giáo án/chương trình hiện tại bằng trang đọc riêng, trình bày theo cấu trúc tài liệu trong ảnh tham khảo và dễ đọc trên laptop lẫn điện thoại. Admin/editor tiếp tục chỉnh sửa trực tiếp trên trang chi tiết.

## Bối cảnh hiện tại

- Frontend dùng Next.js và dữ liệu mẫu phía client.
- Danh sách giáo án và chương trình mở nội dung trong modal/dialog.
- `Lesson` hiện có title, excerpt, content HTML và lời Chúa; các phần giáo án còn lại chưa là field riêng.
- `Program` có metadata và các hàng lịch học; trang chi tiết hiện là dialog.
- Website dự kiến được host tĩnh trên S3 + CloudFront, còn API/backend sẽ được làm sau.

## Quyết định thiết kế

### 1. Điều hướng và URL

Danh sách tiếp tục hiển thị thẻ/tóm tắt để chọn nội dung. Khi chọn một mục, ứng dụng chuyển sang trang đọc riêng trong cùng khu vực nghiệp vụ; không mở modal phủ lên danh sách. URL mang ID nội dung để có thể tải lại, chia sẻ và dùng nút Back của trình duyệt.

Để giữ tương thích với frontend tĩnh trên S3, dùng các route tĩnh hiện có cùng query parameter:

```text
/lesson-plans?lessonId=<id>
/programs?programId=<id>
```

Không dùng dynamic path segment cần server fallback. Khi chưa có ID từ backend, dữ liệu mẫu có ID ổn định; về sau API trả ID và giao diện dùng cùng trường đó.

### 2. Trang đọc giáo án

Trang có nút quay lại danh sách, không gian đọc trung tâm và nội dung theo thứ tự:

1. Số bài, tiêu đề, thời lượng.
2. Lời Chúa và trích dẫn Kinh Thánh.
3. Ý chính.
4. Tâm tình.
5. Chuẩn bị.
6. Gợi ý tiến trình lên lớp.
7. Năm phần nội dung cố định:
   - I. Ổn định
   - II. Em nghe Lời Chúa
   - III. Em nhớ Lời Chúa
   - IV. Em sống Lời Chúa
   - V. Kết thúc

`Gợi ý tiến trình` giữ hai cột hoạt động Giáo lý viên và Học viên trên màn hình rộng; ở điện thoại, mỗi bước thành một khối theo thứ tự, không ép bảng rộng hoặc gây cuộn ngang.

Phong cách tham chiếu sách giấy: nền ấm, cột chữ có độ rộng đọc thoải mái, tiêu đề phần màu nhấn, đường phân cách nhẹ, thân bài serif dễ đọc. Trên điện thoại giảm lề và cỡ chữ hợp lý, giữ điều khiển điều hướng dễ chạm.

### 3. Trang đọc chương trình học

Trang riêng gồm nút quay lại, tên chương trình, ngành/phân ngành, mô tả và lịch học. Laptop hiển thị lịch dạng bảng; điện thoại chuyển mỗi tuần thành một khối nội dung với ngày, tuần, đề tài, nội dung, hoạt động và ghi chú. Mục tiêu là không có cuộn ngang trên màn hình điện thoại.

### 4. Chỉnh sửa trực tiếp và quyền

- Admin/editor thấy nút vào chế độ chỉnh sửa ngay trang đọc.
- Khi chỉnh giáo án, từng vùng có field riêng; phần I–V vẫn giữ nguyên tiêu đề và cho sửa phần nội dung bên dưới. Có lưu/hủy.
- Khi chỉnh chương trình, metadata và các trường từng hàng lịch được sửa ngay tại bố cục trang; có thêm/xóa hàng và lưu/hủy.
- Reader chỉ xem, không thấy điều khiển chỉnh sửa.
- Quyền hiện tại vẫn được áp dụng ở UI; backend sau này phải kiểm tra quyền độc lập.

### 5. Cấu trúc dữ liệu giao diện

Giáo án cần được biểu diễn có cấu trúc thay vì một khối `content` duy nhất:

```text
Lesson
  id, title, number/tag, duration, level, sublevel, summary
  scripture: text, reference
  keyPoints: rich text
  sentiment: rich text
  preparation: rich text
  progression: [{ teacherActivity, learnerActivity }]
  sections: [{ key: I|II|III|IV|V, title, contentHtml }]
```

Các tiêu đề I–V là cố định trong giao diện/dữ liệu; nội dung HTML trong mỗi mục do người biên tập nhập. Các mục mở đầu là field riêng để hiển thị đúng thứ tự và sau này ánh xạ rõ sang API/DynamoDB.

Chương trình giữ ID, title, description, level, sublevel và schedule có các field date, week number, topic, lesson content, activities, notes.

Đối với dữ liệu mẫu hiện tại chưa được chuyển sang cấu trúc mới, giao diện phải giữ nội dung cũ và hiển thị nó như nội dung legacy trong phần đọc thích hợp; không được làm mất nội dung khi mở chi tiết.

## Phạm vi không bao gồm

- Viết Lambda, Terraform hoặc kết nối Cognito/API/DynamoDB.
- Nhập/chuyển toàn bộ sách từ ảnh sang dữ liệu số.
- Thêm chức năng in/PDF hoặc upload ảnh.
- Thay đổi luồng xuất bản draft/published đã thống nhất.

## Tiêu chí chấp nhận

1. Mở giáo án từ danh sách sẽ chuyển tới trang đọc riêng có URL mang `lessonId`; reload URL vẫn mở đúng bài.
2. Mở chương trình từ danh sách sẽ chuyển tới trang đọc riêng có URL mang `programId`; reload URL vẫn mở đúng chương trình.
3. Trang giáo án hiển thị đủ phần đầu, tiến trình và các mục I–V theo đúng thứ tự.
4. Nếu nội dung cũ chưa có field mới, nó vẫn đọc được, không mất dữ liệu.
5. Admin/editor sửa và lưu/hủy nội dung trực tiếp tại trang chi tiết; Reader không có action sửa.
6. Trên viewport điện thoại, trang giáo án và chương trình không có cuộn ngang; tiến trình/lịch được chuyển sang bố cục dọc.
7. Build frontend static vẫn tạo được các route tĩnh; không phụ thuộc vào server-side dynamic route.

## Rủi ro và lưu ý tích hợp

- Thay đổi cấu trúc giáo án tác động tới API contract v1 đã phê duyệt. Trước khi viết backend, cập nhật contract payload/response để khớp các field `keyPoints`, `sentiment`, `preparation`, `progression` và `sections`.
- Query parameter giữ đường dẫn S3 tĩnh ổn định, nhưng client phải xử lý trực tiếp URL, reload và lịch sử điều hướng trình duyệt.
- Nội dung HTML phải tiếp tục qua sanitizer ở backend khi tích hợp; frontend editor không thay thế kiểm tra bảo mật phía server.
