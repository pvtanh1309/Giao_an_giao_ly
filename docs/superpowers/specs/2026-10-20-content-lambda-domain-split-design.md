# Tách Lambda nội dung theo miền chức năng

**Trạng thái:** Hướng hai Lambda nội dung đã được người dùng duyệt trong hội thoại; tài liệu thiết kế này chờ người dùng xem xét. Chưa sửa mã nguồn hoặc hạ tầng AWS.

## 1. Mục tiêu

Tách Lambda nội dung hiện tại thành hai Lambda để mỗi nhóm chức năng có gói mã, quyền IAM, cấu hình và số đo vận hành riêng:

- Lambda giáo án xử lý giáo án, ghi chú cá nhân và ảnh của giáo án.
- Lambda danh mục xử lý chương trình học và tài liệu tham khảo.

Mục tiêu ban đầu là giảm phần khởi tạo không cần thiết cho từng request và tạo ranh giới vận hành rõ hơn. Việc tách chỉ được coi là cải thiện cold start nếu số đo trước/sau chứng minh được điều đó; không suy ra hiệu quả chỉ từ số Lambda hoặc kích thước ZIP.

## 2. Hiện trạng đã xác nhận từ source

- Content API có 32 route: 14 route giáo án/ghi chú/ảnh, 9 route chương trình và 9 route tài liệu tham khảo. Users API có 16 route.
- Terraform của content API hiện tạo một HTTP API, một JWT authorizer, một integration Lambda và nối toàn bộ route vào integration đó.
- Lambda content hiện xử lý cả request HTTP lẫn DynamoDB Stream. Stream consumer lọc item `MEDIA#` để dọn các object ảnh hết hạn; users API riêng xử lý item `ACCOUNT#`.
- `shared.http` import service theo route khi dispatch. Tuy nhiên `content_api.handler` import media stream handler ngay khi module được nạp.
- Script đóng gói hiện tạo `content-api.zip` và `users-api.zip`, kèm dependencies được pin trong `Backend/requirements.txt`. ZIP content chứa toàn bộ source `content_api`; SDK chiếm phần lớn dung lượng ZIP đã được xem trước đây.
- CI manifest và CD workflow hiện biết hai artifact trên. Frontend chỉ có một `NEXT_PUBLIC_CONTENT_API_URL` cho các route nội dung.

Đây là mô tả source trong repository, không phải xác nhận cấu hình đang chạy trên AWS. Số đo cold start Dev hiện chưa được đính kèm.

## 3. Phương án được chọn

Giữ nguyên một Content HTTP API và phân route sang hai Lambda theo integration. Giữ nguyên URL công khai, đường dẫn, payload, envelope, Cognito JWT authorizer, CORS và các hợp đồng API hiện tại.

| Thành phần | Phạm vi |
| --- | --- |
| `lessons-api` | 10 route giáo án, 4 route ghi chú cá nhân; route tạo URL upload ảnh; DynamoDB Stream filter `MEDIA#` và dọn ảnh |
| `catalog-api` | 9 route chương trình học và 9 route tài liệu tham khảo |
| `users-api` | Không đổi; tiếp tục xử lý 16 route người dùng và DynamoDB Stream filter `ACCOUNT#` |
| Content HTTP API | Giữ API ID, stage, JWT authorizer, custom domain, Route 53 mapping, CORS và access logs; chuyển route target sang integration tương ứng |

Các route giáo án công khai/quản lý tiếp tục dùng service logic hiện có. Ghi chú được giữ cùng Lambda giáo án vì thao tác ghi chú phụ thuộc tài khoản đang hoạt động, quyền sở hữu theo Cognito `sub`, và trạng thái PUBLISHED của giáo án. Chưa tạo Lambda ghi chú riêng.

Chương trình và tài liệu tham khảo cùng dùng vòng đời nội dung META/DRAFT/PUBLISHED và không dùng luồng media của giáo án, nên được gom vào `catalog-api`. Không tạo Lambda thứ ba cho tài liệu tham khảo trong phạm vi này.

### Luồng request

1. Frontend gửi request tới Content API hiện tại với access token hiện hành.
2. API Gateway xác minh JWT bằng authorizer Cognito hiện tại.
3. Route của giáo án, ghi chú hoặc upload ảnh được gọi tới `lessons-api`; route chương trình/tài liệu tham khảo tới `catalog-api`.
4. Lambda tiếp tục kiểm tra group, ACCOUNT hiện hành và quyền nghiệp vụ; các quy tắc version, transaction, draft/published, ownership và envelope không thay đổi.
5. `lessons-api` nhận stream event lọc `MEDIA#`. `users-api` tiếp tục nhận stream event lọc `ACCOUNT#`.

## 4. Hạ tầng và bảo mật

Giữ module Content API làm chủ HTTP API và các tài nguyên Gateway. Tạo module/function riêng cho `lessons-api` và `catalog-api`; root môi trường nối ARN của các Lambda với các route integrations. Các module Lambda không tạo thêm HTTP API hoặc custom domain.

IAM được giới hạn theo chức năng:

- `lessons-api`: DynamoDB actions hiện cần cho lesson/note, quyền media trong prefix `lesson-media/`, quyền đọc DynamoDB Stream cho cleanup và `sqs:SendMessage` tới failure queue của consumer.
- `catalog-api`: DynamoDB actions cần cho program/reference và quyền CloudWatch Logs; không cấp quyền S3 media hoặc DynamoDB Stream.
- `users-api`: giữ quyền và stream mapping hiện tại.

Giữ hành vi stream hiện có: batch size, retry, record age, bisection, partial batch response, SQS failure destination, retention và alarm. Khi chuyển mapping `MEDIA#`, tránh vận hành đồng thời hai consumer ngoài thời gian chuyển đổi đã kiểm soát. Consumer vẫn phải xử lý retry/idempotency đúng như hiện tại.

Terraform plan phải xác nhận không thay thế hoặc xóa Content API, stage, authorizer, custom domain, Route 53 record, DynamoDB table, S3 bucket, Cognito pool hoặc Users API. Nếu địa chỉ resource Terraform đổi khi tách module, dùng `moved` block khi phù hợp và kiểm tra plan trước apply. Không thay schema hoặc migrate dữ liệu.

## 5. Backend và artifact

Tạo entry point và route registry riêng cho `lessons-api` và `catalog-api`, dùng chung HTTP/auth/response code hiện có. Giữ business logic đang hoạt động; không viết lại luồng save, publish, notes hay media chỉ để đổi tên package.

Đóng gói artifact riêng:

- `lessons-api.zip`
- `catalog-api.zip`
- `users-api.zip`

Mỗi artifact chứa `shared` cùng phần source domain cần thiết. Có thể giữ dependency pin hiện hành để lần triển khai đầu chỉ đổi một nhóm biến số. Không tuyên bố package nhỏ hơn đáng kể khi vẫn đóng gói boto3/botocore; cần ghi lại kích thước và checksum thực tế.

CI phải chạy kiểm tra Backend hiện có, tạo đủ ba ZIP và manifest SHA-256. CD chỉ chấp nhận artifact đủ ba tên, khớp manifest và cùng source SHA; Terraform deploy dùng đúng đường dẫn ZIP. Giữ workflow dispatch, OIDC, xác nhận môi trường và trình tự deploy hiện tại.

Frontend không đổi env var hay build contract vì Content API URL không đổi. Không đổi các URL API trong `.env.local` hoặc cấu hình public của CD.

## 6. Cold start và tiêu chí đánh giá

Trước thay đổi, ghi baseline Dev cho route đại diện theo `docs/MONITORING.md`: list/detail giáo án, thao tác đọc ghi chú, list/detail chương trình và tài liệu tham khảo. Cùng thời gian ghi release SHA, memory/runtime/architecture, checksum ZIP, số item/kích thước response, concurrency và điều kiện gọi.

So sánh cùng workload sau deploy Dev bằng:

- Lambda REPORT `Init Duration`, `Duration` p50/p95 và tỷ lệ invocation có INIT theo từng Lambda.
- API Gateway `Latency`/`IntegrationLatency` theo route.
- Browser Network duration cho các thao tác đại diện.
- Lỗi, throttling, IteratorAge, failure queue và chi phí.

So sánh cold với cold và warm với warm; không trộn thay đổi memory hoặc dependency cùng lần đầu chuyển route. Hiệu quả cold start chỉ được ghi nhận khi số đo route người dùng chờ cải thiện mà không tạo hồi quy đáng kể ở warm latency, lỗi hoặc chi phí. Do chưa có baseline và mục tiêu latency định lượng, không đặt ngưỡng milliseconds tùy ý trong spec này.

Nếu split không cải thiện latency theo số đo, ghi rõ kết quả và xem xét tối ưu import, reuse SDK client, memory hoặc truy vấn riêng ở một thay đổi có baseline. Không tách notes riêng nếu chưa có bằng chứng hoặc yêu cầu chức năng độc lập.

## 7. Trình tự chuyển đổi và rollback

1. Thu baseline Dev, xác nhận artifact và Terraform hiện hành; chưa thay đổi AWS trong giai đoạn thiết kế.
2. Tách route registries/handler và cập nhật kiểm tra contract để mỗi route thuộc đúng một Lambda.
3. Cập nhật packager, manifest, Backend CI và CD; tạo `terraform plan` cho cả route integration lẫn IAM/stream mapping.
4. Trên Dev, tạo functions/integrations/permissions mới trước, sau đó chuyển route targets và media stream mapping. Giữ nguyên Gateway endpoint.
5. Chạy nghiệm thu Dev: auth/role, CRUD/read, save/publish, notes riêng tư, presigned media, archive/restore, stream cleanup, failure destination, frontend smoke và monitoring.
6. So sánh baseline. Chỉ sau khi Dev đạt tiêu chí mới lập plan Prod riêng và chờ phê duyệt thao tác AWS của môi trường đó.
7. Giữ artifact của release trước và cấu hình route cũ trong cửa sổ rollback. Khi cần rollback, chuyển route về integration cũ và chỉ có một media stream consumer hoạt động. Xóa Lambda cũ sau khi đóng cửa sổ rollback và xác nhận không còn route/mapping tham chiếu.

Rollback không sửa dữ liệu đã ghi và không thay schema; endpoint, auth và contract giữ nguyên. Nếu stream consumer bị lỗi, xử lý SQS theo runbook hiện hành; message SQS không thay thế đầy đủ DynamoDB Stream record.

## 8. Tiêu chí hoàn tất

- Có đúng hai Lambda nội dung: lessons và catalog; Users API vẫn riêng.
- Toàn bộ 32 route Content được ánh xạ đúng một lần, với đúng quyền hiện tại; tổng API contract 48 route không đổi.
- Endpoint, đường dẫn, auth, payload, response envelope, DynamoDB keys/schema và dữ liệu hiện tại không đổi.
- Media cleanup và account cleanup vẫn có đúng consumer, IAM, retry, alarm và failure destination tương ứng.
- CI/CD xác minh đủ artifact/checksum/source SHA; Terraform plan không thay tài nguyên nền tảng ngoài phạm vi.
- Dev được nghiệm thu và có số đo trước/sau cho cold/warm latency cùng bằng chứng vận hành.
- `docs/CONTEXT.md`, `docs/RUNBOOK.md`, `docs/MONITORING.md` và `docs/TROUBLESHOOTING.md` được cập nhật trong cùng thay đổi implementation theo trách nhiệm của từng file.

## 9. Rủi ro và giới hạn

- Tách function có thể tăng tỷ lệ cold start nếu lưu lượng từng miền thấp, do mỗi Lambda có execution environment riêng.
- boto3/botocore vẫn cần cho DynamoDB; gói dependencies chung có thể khiến kích thước ZIP gần tương tự. Chỉ loại source không dùng không đảm bảo cải thiện đáng kể.
- Việc đổi route targets và stream mapping cùng một lần deploy có rủi ro vận hành. Terraform plan phải được xem kỹ; Dev là môi trường thử chuyển đổi đầu tiên.
- Hiện route dispatch đã import service lười, nên phần lợi ích có thể đến từ bỏ import media/stream không cần cho catalog hoặc request HTTP, nhưng cần đo để xác nhận.
- Các thay đổi này không sửa chi phí/thời gian của thuật toán catalog query nhiều item, và không đảm bảo latency của DynamoDB hoặc mạng tốt hơn.

## 10. Nguồn hiện hành

- [CONTEXT.md](../../CONTEXT.md) — route contract, quyền, data lifecycle, media, release và việc còn lại.
- [MONITORING.md](../../MONITORING.md) — baseline và cách so cold/warm latency.
- [RUNBOOK.md](../../RUNBOOK.md) — package, CD, Terraform và deploy từng môi trường.
- [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) — các lỗi CI/CD, Lambda, Stream/SQS và cold start đã ghi nhận.
