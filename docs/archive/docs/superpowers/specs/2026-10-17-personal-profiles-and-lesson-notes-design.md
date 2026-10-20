> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: docs/superpowers/specs/2026-10-17-personal-profiles-and-lesson-notes-design.md. Ngu?n hi?n h?nh: [CONTEXT](../../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# Tài khoản cá nhân, hồ sơ tự cập nhật và ghi chú giáo án riêng

Ngày: 2026-10-17. Trạng thái: người dùng đã duyệt thiết kế; đang lập kế hoạch triển khai.

## 1. Yêu cầu đã chốt

- Mỗi giáo lý viên dùng một tài khoản riêng do Admin cấp.
- Người đọc bôi đen một đoạn trong giáo án rồi thêm ghi chú riêng vào đoạn đó.
- Chỉ chủ tài khoản được đọc, sửa và xóa ghi chú của mình qua ứng dụng/API.
- Ghi chú không thay đổi giáo án chung hoặc trải nghiệm của tài khoản khác.
- Góc tài khoản hiển thị tên giáo lý viên và menu có hai mục: Cập nhật thông tin, Đăng xuất.
- Người dùng tự cập nhật email liên hệ, số điện thoại, lớp chủ nhiệm, lớp đồng hành.
- Email liên hệ trong danh bạ độc lập với email đăng nhập Cognito; thay đổi email liên hệ không đổi thông tin đăng nhập.
- Hồ sơ tự cập nhật và danh sách giáo lý viên dùng cùng một bản ghi dữ liệu.
- Trên điện thoại có đầy đủ thao tác bằng chọn văn bản, nút thêm ghi chú và danh sách ghi chú riêng.

## 2. Hiện trạng và phương án

Hiện ACCOUNT có Cognito sub và catechistId nhưng chỉ Editor được liên kết hồ sơ. Reader chưa được liên kết; một hồ sơ còn có thể có nhiều liên kết tài khoản. Header chỉ có nút đăng xuất. Chưa có API hồ sơ cá nhân hoặc ghi chú.

Phương án chọn: giữ Cognito, hai Lambda và bảng DynamoDB hiện tại; bổ sung liên kết cá nhân, API `/me` và bản ghi ghi chú riêng. Frontend chỉ hiển thị ghi chú sau khi Backend xác thực quyền sở hữu.

Các phương án khác không chọn:

- Chỉ lưu ghi chú trên trình duyệt: mất khả năng dùng cùng ghi chú trên nhiều thiết bị.
- Lưu ghi chú ngay trong document giáo án: trộn dữ liệu cá nhân vào nội dung chung, làm phức tạp phân quyền và xuất bản.

## 3. Tài khoản và liên kết hồ sơ

- Tài khoản Reader mới phải liên kết một hồ sơ giáo lý viên đã tồn tại, như Editor.
- Admin có thể liên kết tài khoản Reader hiện có với hồ sơ qua giao diện quản lý tài khoản.
- Mỗi hồ sơ chỉ được gắn một ACCOUNT chưa bị xóa; tài khoản bị vô hiệu hóa vẫn giữ liên kết.
- Việc cấp hoặc đổi liên kết phải dùng transaction và kiểm tra phiên bản hồ sơ, tránh hai Admin cùng gán một hồ sơ cho hai tài khoản.
- Nếu tài khoản cũ đã chia sẻ một hồ sơ, Admin phải giải quyết liên kết trùng; không tự suy đoán chủ hồ sơ từ email hoặc tên.
- Reader cũ chưa liên kết vẫn đọc được giáo án và dùng ghi chú của chính sub đó. Menu hiển thị email đăng nhập và thông báo liên hệ Admin khi mở cập nhật hồ sơ.
- Tài khoản Admin bootstrap chưa có hồ sơ dùng email làm tên dự phòng, vẫn có nút đăng xuất. Không bắt buộc tạo hồ sơ giáo lý viên cho tài khoản kỹ thuật.
- Ghi chú luôn thuộc sub, không chuyển sang người khác khi Admin đổi liên kết hồ sơ.
- Nếu hồ sơ đã được gán cho người khác sau khi tài khoản cũ bị lưu trữ, không khôi phục liên kết trùng. Admin phải chọn hồ sơ phù hợp trước khi khôi phục đầy đủ chức năng hồ sơ cá nhân.

## 4. Hồ sơ cá nhân và menu

Users API:

| Route | Chức năng |
|---|---|
| `GET /me` | Trả tên hiển thị, email đăng nhập, hồ sơ liên kết và version hồ sơ |
| `PUT /me/profile` | Cập nhật bốn trường liên hệ của chính người đang đăng nhập |

Backend lấy sub từ access token đã xác thực, đọc ACCOUNT đang ACTIVE rồi suy ra catechistId. Body không nhận sub, catechistId, role, name hoặc status. Các trường cập nhật gồm email, phone, group (lớp chủ nhiệm), accompanyingClass và version.

Transaction cập nhật đồng thời kiểm tra ACCOUNT vẫn ACTIVE, liên kết và phiên bản ACCOUNT chưa thay đổi, cùng phiên bản hồ sơ. Xung đột trả 409 và giữ biểu mẫu để người dùng xem lại; không ghi đè mù. Reader không được tự đổi vai trò, trạng thái hoặc hồ sơ liên kết.

Frontend tải `/me` sau đăng nhập. Header hiển thị tên trong hồ sơ, biểu tượng đại diện bằng chữ cái và mũi tên mở menu. Không yêu cầu người dùng tải ảnh đại diện. Menu mở bằng chuột/bàn phím, đóng bằng Escape hoặc bấm bên ngoài. Trên điện thoại menu vẫn truy cập được.

Biểu mẫu ghi rõ "Email liên hệ" và hiển thị email đăng nhập như thông tin chỉ đọc. Lưu thành công cập nhật dữ liệu `/me` và danh bạ trong state; mở lại hoặc tải lại danh bạ đọc cùng CATECHIST record từ Backend. Tab khác thấy thay đổi khi tải lại, không cần hệ thống realtime.

## 5. Ghi chú theo đoạn văn

### Trải nghiệm

1. Trong chế độ đọc giáo án đã xuất bản, chọn một đoạn chữ trong một trường nội dung.
2. Bấm "Thêm ghi chú riêng". Hộp soạn hiển thị đoạn được trích và ô ghi chú.
3. Lưu lên Backend; chỉ báo đã lưu khi có xác nhận. Khi lỗi, giữ nội dung đang soạn để thử lại.
4. Đoạn có ghi chú có đánh dấu riêng trên màn hình của chủ tài khoản. Bấm vào để xem, sửa hoặc xóa.
5. Danh sách "Ghi chú của tôi" trong bài cho phép đọc lại các ghi chú, kể cả ghi chú không còn gắn được đúng đoạn.

Ghi chú ở giai đoạn này là văn bản thuần, tối đa 8000 ký tự. Mỗi bài tối đa 100 ghi chú cho một tài khoản. Chọn chữ chỉ trong một trường rich text hoặc phần Lời Chúa; nếu chọn qua nhiều trường thì yêu cầu chọn lại trong một trường. Không thêm ghi chú lên ảnh hoặc phần soạn bản nháp; Editor/Admin dùng bản đọc đã xuất bản khi ghi chú cá nhân.

Reader mở bản đã xuất bản như hiện tại. Với Editor/Admin, thêm lối mở "Xem bản đã xuất bản" khi bài có bản xuất bản; chế độ này lấy dữ liệu từ route đọc PUBLISHED và cho phép ghi chú cá nhân, tách khỏi chế độ quản lý bản nháp. Bài chưa xuất bản không có chức năng ghi chú cá nhân.

Không có vùng ghi chú chung cho cả bài, ghi chú công khai, chia sẻ ghi chú hoặc thông báo chuông trong phạm vi này.

### Neo vào nội dung

Lưu fieldId ổn định (ví dụ `keyPoints`, `scripture`, `section:<key>`), đoạn trích chính xác, ngữ cảnh trước/sau, vị trí trong văn bản trường, và dấu nhận diện nội dung nguồn. Không neo bằng vị trí pixel hoặc thứ tự DOM toàn trang.

Vị trí được định nghĩa theo Unicode code point, dùng cùng quy tắc dựng văn bản trường ở Frontend và Backend để không lệch với emoji hoặc chữ có dấu. Giới hạn đoạn trích 2000 ký tự, ngữ cảnh mỗi phía 120 ký tự. Backend kiểm tra field và đoạn trích trên bản PUBLISHED thực tế; không tin nội dung giáo án do client gửi.

Khi giáo án được xuất bản bản mới:

- Nếu nội dung trường không đổi, dùng lại vị trí đã lưu sau khi đối chiếu đoạn trích.
- Nếu trường thay đổi, chỉ gắn lại khi tìm được đúng một kết quả khớp đoạn trích và ngữ cảnh.
- Nếu thiếu hoặc có nhiều kết quả, giữ nguyên ghi chú và trích đoạn, hiển thị "Đoạn gốc đã thay đổi" trong danh sách riêng. Không tự gắn vào một đoạn khác hoặc xóa ghi chú.

Đánh dấu bằng decoration của trình soạn thảo ở chế độ đọc. Không thêm mark ghi chú vào TipTap JSON gốc, không gọi API lưu giáo án khi thêm ghi chú.

## 6. Lưu trữ và API ghi chú

Giữ nguyên bảng DynamoDB. Bản ghi ghi chú không có khóa GSI danh bạ/catalog:

- PK: `ACCOUNT#<sub từ JWT>`.
- SK: `LESSONNOTE#<lessonId>#<noteId>`.
- Các trường: entityType, lessonId, noteId, anchor, body, version, createdAt, updatedAt.
- Không dùng email làm khóa. Không lưu ghi chú vào localStorage; localStorage hiện chỉ phục vụ phiên Cognito.

Content API (mọi vai trò đang đăng nhập và ACTIVE):

| Route | Chức năng |
|---|---|
| `GET /me/lessons/{lessonId}/notes` | Danh sách ghi chú của chính tài khoản cho bài này |
| `POST /me/lessons/{lessonId}/notes` | Tạo ghi chú mới với neo vào PUBLISHED |
| `PUT /me/lessons/{lessonId}/notes/{noteId}` | Sửa nội dung ghi chú, bắt buộc version |
| `DELETE /me/lessons/{lessonId}/notes/{noteId}` | Xóa ghi chú của chính mình, bắt buộc version |

Không nhận owner ID từ query/body. Backend tự dựng PK từ principal.sub cho mọi thao tác; dùng noteId của người khác không tìm thấy bản ghi trong partition của mình. Không có endpoint Admin đọc ghi chú của tài khoản khác. Quyền vận hành AWS trực tiếp nằm ngoài phân quyền giao diện/API này.

Danh sách ghi chú dùng query PK và begins_with SK, không scan bảng. GET kiểm tra bài còn được phép đọc, trả tối đa 100 ghi chú. Tạo ghi chú dùng quota guard theo tài khoản/bài trong cùng transaction, để giới hạn 100 vẫn đúng khi mở nhiều tab. Sửa và xóa dùng optimistic concurrency; xóa giảm quota trong transaction tương ứng.

Ghi chú đồng bộ qua Backend giữa các thiết bị khi mở/tải lại bài. Không cần WebSocket. Có nhắc lưu thay đổi khi đóng hộp ghi chú hoặc chuyển trang; không tự xóa bản nháp đang viết sau lỗi mạng. Logout xóa state ghi chú khỏi giao diện.

## 7. Vòng đời và triển khai

- Bài bị lưu trữ: ghi chú không xuất hiện trong giáo án của người đọc. Khôi phục bài khôi phục khả năng mở ghi chú còn lưu.
- Thay đổi/xuất bản nội dung không tự xóa ghi chú.
- Tài khoản bị vô hiệu hóa hoặc lưu trữ: mọi API riêng bị chặn bằng kiểm tra ACCOUNT hiện có.
- Giữ ghi chú trong thời hạn khôi phục tài khoản. Khi ACCOUNT bị purge vĩnh viễn, mở rộng xử lý stream hiện tại để xóa các item ghi chú/quota cùng partition theo batch có thể retry. Không xóa ghi chú chỉ vì đổi email liên hệ hoặc liên kết hồ sơ.
- Khi bài bị purge vĩnh viễn, ghi chú còn lại không mở được qua API bài; dữ liệu vẫn thuộc tài khoản cho đến khi được chủ xóa hoặc tài khoản purge. Không thêm truy vấn toàn bộ ghi chú của mọi người vào API catalog.
- Bổ sung route vào cả registry Python và Terraform HTTP API. Dùng IAM DynamoDB hiện có, chỉ bổ sung quyền nếu thực sự thiếu; không thêm dịch vụ AWS mới.
- Tài khoản hiện có không bị tự chuyển quyền hoặc tự gán hồ sơ. Admin liên kết các Reader cũ theo người thực tế.
- Deploy Backend và Terraform trước Frontend. Không destroy/recreate User Pool hoặc DynamoDB.

## 8. Tiêu chí nghiệm thu

- Reader A và B xem cùng bài; chỉ A thấy ghi chú A, kể cả khi biết noteId của A.
- Editor/Admin qua giao diện/API cũng không đọc được ghi chú của tài khoản khác.
- Reload/đổi thiết bị vẫn lấy lại ghi chú đã lưu; logout/đổi tài khoản không hiển thị state cũ.
- Ghi chú và sửa ghi chú không thay đổi version, bản nháp hoặc bản xuất bản của giáo án.
- Chỉnh nội dung giáo án không làm ghi chú bị gắn nhầm vào đoạn trùng chữ; ghi chú không neo được vẫn xem lại được.
- Người dùng chỉ sửa được bốn trường cho hồ sơ đã liên kết với mình, kể cả khi sửa request thủ công.
- Hai tab cập nhật hồ sơ/ghi chú cũ nhận xung đột và không làm mất thay đổi đã lưu.
- Đổi email liên hệ cập nhật danh bạ; email đăng nhập và sub giữ nguyên.
- Chọn văn bản và mở menu tài khoản hoạt động trên desktop và điện thoại.

Chưa chạy hoặc bổ sung test ở bước thiết kế. Kế hoạch triển khai và kiểm chứng sẽ được chốt sau khi thiết kế này được duyệt.
