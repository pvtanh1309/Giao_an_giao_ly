# Offline tests

Chạy từ Backend: `python -m pytest -q`.

Tests ở thư mục tests bao gồm shared HTTP/auth/TipTap/Store, ma trận reader/editor/admin cho mọi route, content lifecycle/media, profile/account/Cognito compensation, stream TTL và các lỗi từ independent review. Fake kiểm soát concurrency/failure; moto kiểm tra API DynamoDB/Cognito/S3 thực tế của SDK mà không gọi AWS.

Tests không chứng minh IAM, endpoint CORS hoặc deployment hoạt động trên tài khoản AWS; kiểm tra các phần đó theo [runbook](../../docs/deployment-runbook.md).
