# Integration checks

Kiểm thử repository offline dùng moto nằm ở tests/test_repository_integration.py. Các check AWS thật là opt-in theo [deployment runbook](../../docs/deployment-runbook.md); không tự chạy khi pytest.

Sau apply dev: đăng nhập từng role; kiểm tra 401/403; draft/published và version409; upload S3 và GET version cố định; CloudFront không đọc media; disable account với JWT cũ; restore; stream cleanup và failure alarms. TTL bất đồng bộ nên không mong xóa ngay tại deadline.
