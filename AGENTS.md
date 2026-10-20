# Hướng dẫn cộng tác trong repository

1. Đọc [docs/CONTEXT.md](docs/CONTEXT.md) trước khi sửa code. Tài liệu này chứa kiến trúc hiện hành, ranh giới dịch vụ, hợp đồng API, dữ liệu và các quyết định đã chốt.
2. Đọc thêm tài liệu đúng công việc: [RUNBOOK](docs/RUNBOOK.md) cho local/deploy, [TROUBLESHOOTING](docs/TROUBLESHOOTING.md) cho sự cố, [MONITORING](docs/MONITORING.md) cho log/metric/cảnh báo.
3. Đối chiếu tài liệu với source trước khi sửa. Source mô tả triển khai trong repo; state, workflow và log mới xác nhận AWS đang chạy gì. Không biến một đề xuất hoặc kết quả kiểm tra lịch sử thành tính năng đã triển khai.
4. Kiểm tra Git diff và giữ các thay đổi ngoài phạm vi. Không suy ra chỉ dẫn triển khai từ các kế hoạch cũ trong `docs/archive/`. Chỉ đọc archive khi cần truy nguyên quyết định/sự cố; `.rgignore` bỏ archive khỏi tìm kiếm mặc định, có thể dùng `rg --no-ignore` để tra lịch sử có chủ đích.
5. Giữ các ràng buộc quyền và dữ liệu trong CONTEXT: access token, ACCOUNT hiện hành, ownership ghi chú, version/transaction, draft/published, media private và bảo vệ môi trường.
6. Khi thêm/sửa chức năng hoặc thay đổi code làm đổi hành vi, kiến trúc, hợp đồng, cấu hình, deploy hay vận hành, cập nhật các file `.md` chuẩn liên quan trong cùng thay đổi. Nếu một thay đổi code không làm đổi hành vi hay cách cộng sự hiểu, phát triển, triển khai hoặc vận hành hệ thống (ví dụ chỉ định dạng hoặc sửa test), không cần tạo cập nhật tài liệu hình thức. Bốn tài liệu có trách nhiệm riêng; dùng liên kết thay vì chép lại hướng dẫn.
7. Kiểm tra phù hợp với phần thay đổi và báo đúng phạm vi đã kiểm chứng. Không dùng credentials thật cho test offline; không đưa token, password, state hoặc tfvars riêng vào Git/log.
8. Các lệnh apply, destroy, cấp tài khoản hoặc sửa IAM tác động AWS. Thực hiện theo phạm vi người dùng đã cho phép và runbook của đúng môi trường.

Trong Frontend, đọc thêm `Frontend/AGENTS.md` và tài liệu Next.js cài trong `Frontend/node_modules/next/dist/docs/` cho API/framework liên quan. Giữ block hướng dẫn do Next.js sinh.
