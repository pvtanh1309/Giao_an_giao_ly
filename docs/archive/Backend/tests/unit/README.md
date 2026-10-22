> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: Backend/tests/unit/README.md. Ngu?n hi?n h?nh: [CONTEXT](../../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# Offline tests

Chạy từ Backend: `python -m pytest -q`.

Tests ở thư mục tests bao gồm shared HTTP/auth/TipTap/Store, ma trận reader/editor/admin cho mọi route, content lifecycle/media, profile/account/Cognito compensation, stream TTL và các lỗi từ independent review. Fake kiểm soát concurrency/failure; moto kiểm tra API DynamoDB/Cognito/S3 thực tế của SDK mà không gọi AWS.

Tests không chứng minh IAM, endpoint CORS hoặc deployment hoạt động trên tài khoản AWS; kiểm tra các phần đó theo [runbook](../../docs/deployment-runbook.md).
