# Kho giáo án và chương trình học giáo lý

Ứng dụng cho giáo lý viên: đọc và soạn giáo án, quản lý chương trình học, tài liệu tham khảo, danh bạ, tài khoản cá nhân và ghi chú riêng.

**Bắt đầu bằng [docs/CONTEXT.md](docs/CONTEXT.md) trước khi sửa code.** Đây là tài liệu ngữ cảnh chung cho người và AI, được đối chiếu với source ngày 20/10/2026. Trạng thái AWS thực tế phải được xác nhận qua state, workflow và log của môi trường tương ứng.

| Cần làm gì? | Đọc ở đâu? |
| --- | --- |
| Hiểu kiến trúc, quyền, dữ liệu, API, source và việc còn lại | [CONTEXT](docs/CONTEXT.md) |
| Cài local, dựng AWS, deploy, rollback, destroy Dev | [RUNBOOK](docs/RUNBOOK.md) |
| Tìm nguyên nhân và xử lý lỗi | [TROUBLESHOOTING](docs/TROUBLESHOOTING.md) |
| Theo dõi release, log, metric, cold start, cleanup và cảnh báo | [MONITORING](docs/MONITORING.md) |

Code chính ở [Frontend](Frontend/), [Backend](Backend/) và [infrastructure](infrastructure/). Hướng dẫn cho công cụ AI ở [AGENTS.md](AGENTS.md).

Tài liệu cũ đã chuyển vào [docs/archive](docs/archive/README.md) để tra lịch sử; chúng không phải hướng dẫn triển khai hiện hành. Cập nhật bốn tài liệu chuẩn khi thay đổi hệ thống, tránh tạo thêm một bản context/runbook song song.
