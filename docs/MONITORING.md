# Monitoring và phản hồi sự cố

Đối chiếu Terraform/source ngày **20/10/2026**. Đây là cách theo dõi hệ thống hiện có và các khoảng trống cần bổ sung. Không giả định mọi alarm/subscription đã được apply trên AWS. [CONTEXT](CONTEXT.md) · [RUNBOOK](RUNBOOK.md) · [TROUBLESHOOTING](TROUBLESHOOTING.md).

## 1. Trách nhiệm và lịch theo dõi

- Người deploy ghi release SHA, Backend CI run ID, CD run/attempt, environment, thời điểm và bản tốt trước; theo dõi đến hết smoke và kiểm tra nghiệp vụ.
- Operator của môi trường nhận SNS, xử lý Lambda/stream/failure queue và điều phối phục hồi. Cần chỉ định người thật nhận trách nhiệm; repo chưa cấu hình lịch trực.
- Người sửa code điều tra request/log và thêm bằng chứng tái hiện, không yêu cầu người dùng gửi password/JWT.

Sau mỗi release: kiểm tra 15–30 phút đầu với các luồng đọc, save/publish, login, upload và account/note liên quan. Khi có alarm: phản hồi sớm, đặc biệt stream có thời hạn dữ liệu. Hằng ngày: xem failure queues, alarm mới và lỗi API; hằng tuần: xem xu hướng latency/error/cost và tài nguyên dư. Tần suất này là quy trình vận hành đề xuất, không phải automation đã có trong Terraform.

## 2. Xác định đúng môi trường và tài nguyên

Từ root, dùng profile có quyền đọc đúng môi trường:

~~~powershell
$env:AWS_PROFILE = 'giaoan-dev'
$env:AWS_DEFAULT_REGION = 'ap-southeast-1'
$infra = Join-Path (Get-Location).Path 'infrastructure/environments/dev'
aws sts get-caller-identity
terraform "-chdir=$infra" output
~~~

Lấy ID hiện tại từ outputs, không chép API/pool/distribution ID trong một log cũ. `frontend_url` có thể là custom domain khác CloudFront domain. Tên mặc định dưới đây chỉ đúng khi project_name=giaoan, environment=dev:

| Tài nguyên | Tên/vị trí |
| --- | --- |
| Lessons Lambda | `giaoan-dev-lessons-api` |
| Catalog Lambda | `giaoan-dev-catalog-api` |
| Users Lambda | `giaoan-dev-users-api` |
| Lambda log groups | `/aws/lambda/giaoan-dev-lessons-api`, `/aws/lambda/giaoan-dev-catalog-api`, `/aws/lambda/giaoan-dev-users-api` |
| Legacy content Lambda log group | `/aws/lambda/giaoan-dev-content-api` (retained for history) |
| API access log groups | `/aws/apigateway/giaoan-dev-content-api`, `/aws/apigateway/giaoan-dev-users-api` |
| Lessons failure queue | output `lessons_stream_failure_queue_url`; `content_stream_failure_queue_url` is a compatibility alias |
| Users failure queue | output `users_stream_failure_queue_url` |
| SNS topic | output `alarm_topic_arn` |
| DynamoDB table | output `table_name` |
| CloudFront | output `cloudfront_distribution_id` |

Các API/Lambda/DB/SQS metric ở ap-southeast-1; CloudFront metric dùng region Global trong CloudWatch us-east-1. Log retention mặc định root Dev 14 ngày, Prod 90 ngày; module có default riêng nhưng root truyền cấu hình thực tế.

## 3. Cảnh báo đã có trong Terraform

Source có alarm Errors/Throttles cho cả ba Lambda. IteratorAge chỉ được cấu hình cho Lessons và Users vì chỉ hai Lambda này tiêu thụ stream:

| Alarm/metric | Điều kiện trong source | Hành động operator |
| --- | --- | --- |
| Lambda `Errors` | Sum ≥1 trong 300 giây, 1 period | Tra runtime exception/timeout và log theo request |
| Lambda `Throttles` | Sum ≥1 trong 300 giây, 1 period | Kiểm tra concurrency, traffic, quota và upstream |
| Lambda `IteratorAge` | Maximum >3.600.000 ms trong 300 giây | Consumer chậm hơn 1 giờ; ưu tiên điều tra trước khi stream hết hạn |
| SQS `ApproximateNumberOfMessagesVisible` | Maximum ≥1 trong 300 giây | Mở incident cleanup, xem nguyên nhân batch fail |

Catalog không có IteratorAge alarm, S3 quyền, stream mapping hay SQS failure destination. Queue media giữ physical name cũ `giaoan-dev-content-api-stream-failures`; tên này không có nghĩa content-api cũ còn là consumer. Tên và trạng thái AWS phải được xác minh sau khi split được deploy.

Missing data được coi notBreaching. Alarm gửi SNS topic; `notification_email=null` thì chưa có email subscriber do root tạo. Kiểm tra subscription đã Confirmed và người vận hành thực sự nhận được thông báo.

**Giới hạn quan trọng:** `shared/http.py` bắt exception rồi trả response HTTP 500 dưới dạng JSON. Lambda invocation có thể được tính thành công và `Errors=0` dù người dùng nhận 500. Partial stream failures cũng không nhất thiết thể hiện thành runtime Errors. Theo dõi thêm API 5xx, log ứng dụng, IteratorAge và failure queues.

## 4. Log và tương quan request

Frontend error có `requestId` nếu API trả envelope. Lấy ID đó cùng route, environment và thời điểm, không lấy raw Authorization/body.

API access log hiện ghi JSON:

~~~text
requestId, routeKey, status, responseLength, integrationError
~~~

Lambda log lỗi HTTP hiện có `request_failed request_id=... exception_type=...`. Account provisioning có log identifier khi compensation/outcome không xác định; tuyệt đối không in SDK args/password để tăng chẩn đoán.

**Hai ID khác nhau:** meta.requestId ưu tiên API Gateway requestContext.requestId; Lambda START/END/REPORT dùng AWS invocation request ID. Không mặc định cả hai bằng nhau. Hiện chưa có log nối hai ID cho mọi request thành công; khi cần nối duration chính xác phải đối chiếu thời gian/log stream hoặc bổ sung instrumentation có review.

Xem log gần nhất:

~~~powershell
aws logs tail /aws/lambda/giaoan-dev-lessons-api --since 1h --format short
aws logs tail /aws/lambda/giaoan-dev-catalog-api --since 1h --format short
aws logs tail /aws/lambda/giaoan-dev-users-api --since 1h --format short
aws logs tail /aws/lambda/giaoan-dev-content-api --since 1h --format short
aws logs tail /aws/apigateway/giaoan-dev-content-api --since 1h --format short
~~~

Console: CloudWatch → Logs Insights → chọn đúng log group + khoảng thời gian (ghi rõ UTC hay Asia/Bangkok). Truy vấn theo application requestId:

~~~sql
fields @timestamp, @logStream, @message
| filter @message like /REQUEST_ID_DA_CHE_DU_LIEU/
| sort @timestamp asc
| limit 100
~~~

Thay placeholder bằng ID thật; nếu có ký tự regex đặc biệt cần escape. Với API log JSON:

~~~sql
fields @timestamp, requestId, routeKey, status, integrationError
| filter status like /^5/
| sort @timestamp desc
| limit 100
~~~

Đếm status theo route:

~~~sql
stats count(*) as requests by routeKey, status
| sort requests desc
~~~

401/403 có thể là quyền hoạt động đúng; đọc route và thời điểm. 409 có thể là thao tác đồng thời bình thường; tăng đột biến hoặc mất nội dung cần điều tra.

## 5. Đo latency và cold start

### Chọn đúng số đo

| Số đo | Ý nghĩa |
| --- | --- |
| Browser Network duration | Người dùng chờ: mạng, preflight/token và request; các bước có thể là nhiều request riêng |
| HTTP API `Latency` | Gateway nhận request đến trả response |
| HTTP API `IntegrationLatency` | Gateway chờ backend integration |
| Lambda REPORT `Duration` | Handler thực thi, gồm SDK/network/lazy import chạy trong handler |
| Lambda REPORT `Init Duration` | Nạp runtime/code và init ngoài handler trong lần cold start thông thường |
| `Billed Duration` | Dữ liệu tính phí, không dùng thay cho latency trình duyệt |

Xem API Gateway Metrics hoặc CloudWatch namespace `AWS/ApiGateway`, chọn ApiId/Stage và route khi detailed metrics được bật. Source stage hiện bật `detailed_metrics_enabled=true`. API access log chưa ghi latency, nhưng có thể xem metric Latency/IntegrationLatency của Gateway.

Đối với Lambda log định dạng REPORT text, parse init trực tiếp:

~~~sql
filter @type = "REPORT"
| parse @message /Init Duration: (?<initMs>[0-9.]+) ms/
| stats count(*) as invocations,
        count(initMs) as coldInvocations,
        100.0 * count(initMs) / count(*) as coldPercent,
        pct(@duration, 50) as handlerP50Ms,
        pct(@duration, 95) as handlerP95Ms,
        avg(initMs) as initAvgMs,
        pct(initMs, 95) as initP95Ms
  by bin(15m)
~~~

So handler cold/warm trong cùng thời gian:

~~~sql
filter @type = "REPORT"
| parse @message /Init Duration: (?<initMs>[0-9.]+) ms/
| stats count(*) as requests,
        avg(@duration) as handlerAvgMs,
        pct(@duration, 95) as handlerP95Ms,
        max(@maxMemoryUsed) as maxMemoryBytes
  by ispresent(initMs)
~~~

`ispresent(initMs)=true` là nhóm REPORT có init. Nếu không thấy dữ liệu, xem raw log format/khoảng thời gian; JSON runtime logs hoặc suppressed init sau lỗi có thể cần query/tracing khác. Không kết luận không có cold start chỉ vì một query rỗng.

### Baseline trước tối ưu/tách Lambda

1. Ghi SHA, config memory/runtime/architecture, ZIP checksum, route, số item/kích thước response và concurrency. Chỉ so các phép đo có điều kiện tương đương.
2. Trước cutover, dùng Dev với token/account có quyền, đọc endpoint đại diện: list/detail lessons, list/detail programs, list/detail references, notes. Sau cutover, chạy cùng workload trên Lessons/Catalog; lưu browser timings và CloudWatch cùng thời gian.
3. Thu nhiều mẫu cold có bằng chứng Init Duration và mẫu warm, so p50/p95/tỷ lệ cold. Không coi “để yên vài phút” là đảm bảo đã cold.
4. So INIT và handler. Đo số call DB/S3/lazy import nếu handler chậm; thư viện import bên trong dispatch nằm trong Duration.
5. Sau khi có baseline mới thay một yếu tố: client reuse/import, memory hoặc domain packaging. Thay config/deploy để thử là thao tác AWS riêng, không chạy trong quy trình chỉ đọc log.
6. Đo lại cùng workload và xem chi phí; tách Lambda có thể làm các chức năng ít truy cập có môi trường warm riêng. Không đo chỉ một request rồi kết luận.

Mẫu ghi kết quả:

| SHA/config | Route/workload | Cold count/tổng | Init p95 | Handler warm p95 | Gateway p95 | Browser p95 |
| --- | --- | --- | --- | --- | --- | --- |
| Điền số đo thực | Điền điều kiện | Chưa đo | Chưa đo | Chưa đo | Chưa đo | Chưa đo |

Không có số latency production được xác nhận trong đợt tổng hợp tài liệu này. Baseline Dev trước khi tách Lambda cũng chưa thu được vì profile AWS Dev chưa có trong môi trường thực hiện; không kết luận split cải thiện cold start cho tới khi đo được baseline và workload sau cutover.

## 6. Streams, SQS và TTL cleanup

Kiểm tra mapping thay vì chỉ nhìn Lambda invocation HTTP:

~~~powershell
aws lambda list-event-source-mappings --function-name giaoan-dev-lessons-api --query 'EventSourceMappings[].{UUID:UUID,State:State,LastResult:LastProcessingResult,Source:EventSourceArn}'
aws lambda list-event-source-mappings --function-name giaoan-dev-users-api --query 'EventSourceMappings[].{UUID:UUID,State:State,LastResult:LastProcessingResult,Source:EventSourceArn}'
~~~

Xem State/LastProcessingResult, filter và source ARN có đúng stream mới sau table recreation không. Partial batch failures dùng sequence number; event-source mapping retry/bisection/age limit không phải consumer đọc queue.

Đọc queue attributes:

~~~powershell
$queueUrl = terraform "-chdir=$infra" output -raw lessons_stream_failure_queue_url
if ($LASTEXITCODE -ne 0) { throw 'Không lấy được queue URL' }
aws sqs get-queue-attributes --queue-url $queueUrl --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible MessageRetentionPeriod
~~~

Lặp với users queue. Trên CloudWatch xem Visible, NotVisible và ApproximateAgeOfOldestMessage. Số queue là approximate; việc message tạm invisible không chứng minh đã xử lý xong.

Khi queue có message:

1. Ghi incident, queue, timestamp, function/source ARN, shard và sequence metadata; bảo toàn message và log.
2. Phân loại cleanup media hay ACCOUNT/Cognito. Xem IAM/network, mapping, timeout và resource đang có.
3. Streams chỉ giữ record 24 giờ; message SQS có metadata không tự lưu toàn bộ OldImage. Điều tra sớm để còn truy xuất record gốc khi cần.
4. Đối chiếu item hiện tại/restore/recreate trước khi cleanup lại. Media chỉ xóa đúng key/version; user cleanup cần ACCOUNT đã vắng mặt thật và không phải Admin.
5. Sửa nguyên nhân; replay/cleanup có chủ đích bằng dữ liệu đã xác minh và quyền phù hợp. Hiện chưa có lệnh replay generic hoặc worker SQS được triển khai.
6. Chỉ acknowledge/delete message sau khi xác nhận tác vụ đã xử lý và có ghi nhận. Poll/receive có thể thay visibility; không dùng purge để làm alarm hết đỏ.

TTL sau 1/10 ngày là hết hạn logic; xóa vật lý và S3/Cognito cleanup có thể đến muộn. Với media, ảnh còn được PUBLISHED tham chiếu phải được giữ. Với note, account purge mới kích hoạt cleanup note/quota hiện hành.

## 7. Các phần còn lại cần quan sát

| Dịch vụ | Cách theo dõi | Điểm cần diễn giải đúng |
| --- | --- | --- |
| API Gateway | Count, 4xx, 5xx, Latency, IntegrationLatency theo API/route | 401 smoke là chủ đích; HTTP 500 có thể không hiện trong Lambda Errors |
| Lambda | Invocations, Duration p95, Errors, Throttles, ConcurrentExecutions, REPORT memory/init | Lessons HTTP + MEDIA stream; Users HTTP + ACCOUNT stream; Catalog chỉ HTTP |
| DynamoDB | Read/WriteThrottleEvents, SuccessfulRequestLatency, SystemErrors, lượng request/cost, backup/PITR | Catalog đọc lại nhiều item; tăng dữ liệu có thể chậm dù INIT thấp |
| S3 media | Versioning, private prefix, object versions và lỗi presigned trong Network | Signed URL hết hạn không đồng nghĩa object đã mất |
| CloudFront | Requests, 4xxErrorRate, 5xxErrorRate, distribution status/invalidation | Check origin frontend/ và release SHA trước khi xóa cache |
| Cognito/account | Login thật, user/group và ACCOUNT cùng môi trường; CloudTrail cho admin operations khi có | Pool user và hồ sơ cá nhân là dữ liệu khác nhau; không log credentials |
| Release | GitHub run/attempt/source SHA/artifact expiration/summary | Terraform apply có thể xong trước khi build/upload Frontend lỗi |
| Chi phí | Billing/Cost Explorer, budget actual/forecast, tags | Budget không dừng resource; SNS subscription cần xác nhận |

## 8. Khoảng trống và hướng bổ sung

Các mục sau là đề xuất, **chưa được cấu hình thành resource/automation**:

- Dashboard chung cho HTTP status/latency, Lambda duration/init/concurrency, DynamoDB và queues.
- Alarm API 5xx/error rate, p95 latency, queue oldest age và ngưỡng IteratorAge phù hợp nhu cầu sớm hơn 1 giờ.
- Structured timing/correlation log cho đường HTTP thành công: gateway request ID + Lambda invocation ID + route + elapsed, không body/token.
- Tracing để tách thời gian import/auth/DB/S3 khi baseline không giải thích được độ trễ.
- Quy trình replay có kiểm soát, lưu đủ bằng chứng failed stream trước hạn và chịu được restore/recreate.
- Kiểm tra nghiệp vụ tự động sau deploy bằng account test được quản lý; smoke 200/401 hiện tại chưa đủ.

Mỗi bổ sung cần cập nhật Terraform/source, chi phí và hướng dẫn tại đây; không mô tả dashboard/alarm như đã có chỉ vì đã ghi trong tài liệu.

## 9. Mẫu bản ghi và nguồn

~~~text
Môi trường / SHA / thời điểm và múi giờ:
API route / requestId / Lambda invocation ID nếu có:
Triệu chứng / status / metric trước-sau:
Log group / stream / query / time range:
Queue/mapping/batch metadata nếu liên quan:
Người tiếp nhận / mức tác động:
Hành động / kết quả / việc còn lại:
~~~

Source hiện hành: [Content API routing module](../infrastructure/modules/content-api/main.tf), [Lessons module](../infrastructure/modules/lessons-api/main.tf), [Catalog module](../infrastructure/modules/catalog-api/main.tf), [Users module](../infrastructure/modules/user-api/main.tf), [dev root](../infrastructure/environments/dev/main.tf), [prod root](../infrastructure/environments/prod/main.tf), [HTTP logging](../Backend/shared/http.py).

Tài liệu chính thức: [HTTP API metrics](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-metrics.html), [Lambda log queries](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs-view.html), [Python REPORT fields](https://docs.aws.amazon.com/lambda/latest/dg/python-logging.html), [DynamoDB failed stream destination](https://docs.aws.amazon.com/lambda/latest/dg/services-dynamodb-errors.html), [DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html).
