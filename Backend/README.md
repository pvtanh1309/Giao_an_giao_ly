# Backend

Python 3.12 cho Lessons API, Catalog API và Users API, dùng shared HTTP/auth/validation và DynamoDB transactions. Lessons xử lý giáo án, note, media; Catalog xử lý chương trình và tài liệu tham khảo.

Đọc [CONTEXT](../docs/CONTEXT.md) trước khi code: kiến trúc, 48 route hiện hành, quyền, schema và vòng đời dữ liệu. Bảng route ở context được [test_routes.py](tests/test_routes.py) đối chiếu với Python registry và Terraform.

- Cài dependency, test, package, tạo admin, deploy: [RUNBOOK](../docs/RUNBOOK.md).
- Chẩn đoán API/account/media/CI: [TROUBLESHOOTING](../docs/TROUBLESHOOTING.md).
- CloudWatch, cold start, Streams/SQS: [MONITORING](../docs/MONITORING.md).

Source: [lessons_api](lessons_api/), [catalog_api](catalog_api/), [content_api services](content_api/), [users_api](users_api/), [shared](shared/), [scripts](scripts/), [tests](tests/). Tài liệu Backend cũ giữ trong [archive](../docs/archive/README.md).
