> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: Backend/docs/personal-accounts.md. Ngu?n hi?n h?nh: [CONTEXT](../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# Tài khoản cá nhân và ghi chú riêng

## Triển khai

1. Đóng gói lại cả hai Lambda bằng workflow/script hiện có. Content API thêm bốn route ghi chú; Users API thêm `GET /me`, `PUT /me/profile`.
2. Chạy `terraform plan` và `terraform apply` trong environment tương ứng để cập nhật Lambda và route. Không destroy User Pool hoặc DynamoDB. Không có dịch vụ AWS hay biến môi trường mới.
3. Build lại Frontend với `.env.local` của environment, upload `out/` và invalidation CloudFront theo workflow hiện có.

## Cấp tài khoản

- Tạo hồ sơ giáo lý viên trong danh sách trước, sau đó Admin tạo tài khoản Reader và chọn đúng hồ sơ. Mỗi hồ sơ chỉ liên kết một tài khoản còn hiệu lực; tài khoản khóa vẫn giữ liên kết.
- Tài khoản cũ chưa liên kết vẫn đăng nhập và đọc được. Admin dùng **Đổi hồ sơ liên kết** để gán thủ công; hệ thống không đoán theo tên/email. Không tiếp tục chia sẻ một tài khoản cho nhiều người.
- Tài khoản DELETED giữ liên kết trong thời gian khôi phục nhưng không chiếm hồ sơ. Nếu hồ sơ đã được cấp cho tài khoản khác thì restore báo xung đột; Admin đổi liên kết trước khi restore.
- Email liên hệ do giáo lý viên tự cập nhật độc lập với email đăng nhập Cognito. Tên và quyền do Admin quản lý.

## Ghi chú

- Reader bôi đen chữ trong một mục của giáo án đã xuất bản: tùy chọn **Viết ghi chú** xuất hiện cạnh đoạn chọn. Chỉ khi bấm tùy chọn này mới mở ô nhập. Bỏ chọn sẽ ẩn tùy chọn. Admin/Editor chọn **Xem bản đã xuất bản và ghi chú riêng**.
- Bấm đoạn tô dấu để mở ghi chú đã lưu. Nút **Ghi chú của tôi** trên thanh điều khiển mở danh sách khi bài có ghi chú; không có khung ghi chú thường trực che bài đọc.
- Ghi chú gắn với JWT sub, không nằm trong revision giáo án. Người khác, kể cả Admin, không lấy được ghi chú qua API của ứng dụng. Người có quyền vận hành trực tiếp DynamoDB vẫn có thể truy cập dữ liệu theo quyền AWS.
- Khi xuất bản lại, vị trí chỉ được tô dấu nếu xác định chắc chắn bằng hash hoặc trích đoạn/ngữ cảnh duy nhất. Ghi chú mất vị trí vẫn nằm trong danh sách riêng, có thể sửa/xóa.
- Tối đa 100 ghi chú/bài/tài khoản. Khi nhiều tab cập nhật cùng ghi chú, version conflict giữ nguyên nội dung đang nhập để người dùng sao chép trước khi tải lại.
- Archive tài khoản/giáo án không xóa ngay ghi chú. Khi tài khoản hết thời hạn lưu trữ và DynamoDB TTL xóa ACCOUNT, Users stream dọn các ghi chú/quota, rồi xóa Cognito và reverse link. Partial batch failure hỗ trợ retry/DLQ hiện có; không có consumer SQS mới.

## Kiểm tra local

```powershell
# Tại Backend
..\.venv\Scripts\python.exe -m pytest -q
# Tại Frontend
npm test
npm run build
npm run test:personal-ui
npm run test:content-ui
```

Hai script Chrome dùng backend Python giả lập trong bộ nhớ, chặn request ra AWS. Cần Chrome local, virtualenv có dependencies test và `.env.local` có các biến public để build; script không sử dụng mật khẩu thật.
