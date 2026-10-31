# Troubleshooting

Đối chiếu source ngày **20/10/2026**. Quy trình chuẩn ở [RUNBOOK](RUNBOOK.md), ngữ cảnh ở [CONTEXT](CONTEXT.md), cách lấy log/metric ở [MONITORING](MONITORING.md).

**Nguồn sự cố:** mục ghi “đã gặp” lấy từ lịch sử trò chuyện hiện có hoặc runbook/ledger đã lưu trong repo. Đây không phải quyền truy cập toàn bộ lịch sử chat bên ngoài phiên. “Có thể gặp” là tình huống phòng ngừa; “giả thuyết” chưa được coi là nguyên nhân đã chứng minh trên AWS.

## 1. Thu bằng chứng trước khi sửa

Ghi environment, source SHA, CI/CD run ID + attempt, step, thời điểm/múi giờ, endpoint/route, HTTP status, application error code, meta.requestId và AWS RequestID nếu có. Đối chiếu code ở SHA được deploy, state và policy đang gắn thực tế.

Không gửi token, password, access key, toàn bộ env, state/tfvars hoặc body chứa dữ liệu riêng vào issue/chat/log. Có thể lấy tên biến môi trường để biết nguồn credentials mà không in giá trị:

~~~powershell
Get-ChildItem Env:AWS* | Select-Object -ExpandProperty Name
aws configure list
aws configure list-profiles
aws sts get-caller-identity
~~~

Xác định lỗi nằm ở local CLI → credentials/state → plan/apply → OIDC/IAM → build/artifact → upload/cache → API/auth → dữ liệu. Thay một nguyên nhân mỗi lần và giữ bằng chứng trước/sau.

## 2. AWS CLI và PowerShell

### 2.1 Profile giaoan_dev không tồn tại — đã gặp

CLI báo `The config profile (giaoan_dev) could not be found`, trong khi list-profiles có `giaoan-dev`.

Đặt `AWS_PROFILE` và `AWS_DEFAULT_PROFILE` bằng đúng tên đã có; không tạo access key mới chỉ để chữa lỗi chính tả. Kiểm tra STS lại trong cùng shell trước khi Terraform init.

### 2.2 InvalidClientTokenId khi terraform init/output — đã gặp

STS trả 403 có thể do credentials sai/hết hạn, bộ temporary credentials thiếu token hoặc shell đang ưu tiên nguồn cũ. Virtualenv Python không cấp hay làm mới AWS credentials.

Đặc biệt đã gặp: `aws sts get-caller-identity --profile giaoan-dev` thành công nhưng Terraform vẫn lỗi. Lệnh CLI có profile tường minh không chứng minh Terraform đang dùng cùng nguồn.

Kiểm tra:

1. `aws configure list`, profile/region trong shell; có biến access key/session token cũ không.
2. Khi chủ đích dùng named profile, bỏ bộ key cũ của shell theo RUNBOOK, đặt cả hai profile nhất quán và chạy **STS không truyền profile**.
3. Với SSO, login lại đúng profile. Kiểm tra `AWS_CONFIG_FILE/AWS_SHARED_CREDENTIALS_FILE` nếu được đặt.
4. Đối chiếu backend S3 với AWS provider: backend khởi tạo riêng, provider profile không tự cấu hình backend. Nếu backend từng lưu cấu hình profile khác, review rồi init -reconfigure.

Không chép access keys vào Terraform để vượt lỗi. [Terraform S3 credentials](https://developer.hashicorp.com/terraform/language/backend/s3).

### 2.3 Too many command line arguments khi plan — đã gặp

PowerShell có thể xử lý không như mong muốn với `-out=dev.tfplan` trong lệnh đã copy. Chạy từ root:

~~~powershell
terraform "-chdir=$infra" plan "-out=dev.tfplan"
~~~

`-chdir` là global option đặt trước subcommand. Đọc cả dấu quote/newline khi copy. Backslash `\` không phải ký tự nối dòng PowerShell; dùng một dòng hoặc backtick đúng cú pháp.

### 2.4 Không tìm thấy .venv/Scripts/python.exe — đã gặp

Lệnh root bị chạy tại `Backend/scripts` nên đường dẫn bị lặp. Chạy từ root theo RUNBOOK, hoặc dùng interpreter đã kích hoạt bằng `python` nếu PATH có. Không coi `(.venv)` là bằng chứng đang đứng ở root. Kiểm tra `Test-Path .venv/Scripts/python.exe` và `Get-Location`.

### 2.5 pnpm launcher hỏng / npm run dev có dùng được không — đã gặp

`npm run dev` gọi cùng script next dev và dùng được với dependencies đã cài. Toolchain chuẩn vẫn là pnpm/lockfile đã pin. Nếu `pnpm exec tsc` bị hỏng launcher trên Windows nhưng dependencies đã đủ, có thể gọi `Frontend/node_modules/.bin/tsc.cmd --noEmit` từ đúng thư mục Frontend; sau đó sửa installation/PATH. Không đổi package manager/lockfile để né lỗi môi trường.

## 3. Terraform và tài nguyên

### 3.1 DynamoDB NonKeyAttributes vượt 20 — đã gặp

CreateTable từng bị từ chối vì GSI INCLUDE liệt kê quá nhiều field. Source hiện dùng **KEYS_ONLY** tại [database/main.tf](../infrastructure/modules/database/main.tf). Các consumer lấy key từ index rồi đọc base table, nên không cần nhét metadata/rich text vào projection.

Đối chiếu source SHA và plan thật. Nếu deploy vẫn báo lỗi cũ, kiểm tra workflow đang checkout release nào. Không destroy table hoặc xóa field nghiệp vụ để chữa projection. [AWS Projection](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Projection.html).

### 3.2 Output not found vì truyền tên bucket — đã gặp

`terraform output -raw` nhận tên khai báo output, ví dụ `app_bucket_name`, không phải giá trị `giaoan-dev-app-...`. Dùng mapping trong RUNBOOK. Nếu vừa thêm output vào source, review/apply để state có output mới; không destroy.

### 3.3 No changes nhưng muốn bật export / cập nhật UI — đã gặp

`output: 'export'` nằm ở `Frontend/next.config.mjs`, không phải Terraform. Build mới sinh out; build local không tự upload S3. Sửa public env phải build lại vì giá trị đã nhúng vào JS. `No changes` không đồng nghĩa UI mới đã được phát hành.

### 3.4 Plan muốn tạo lại toàn bộ / resource already exists — có thể gặp

Kiểm tra backend bucket/key, account/region, project_name/environment, state list và resource thực. Một lần apply lỗi sau create có thể để resource ngoài state; đây là khả năng cần đối chiếu, không tự khẳng định.

Pool ID không tự đổi trên cùng pool: ID khác nghĩa là resource khác. Xem replacement/taint/state/read-after-create failure trước khi import/dọn orphan. Không đổi key, xóa state hoặc destroy để “đồng bộ”.

### 3.5 State lock hoặc init backend AccessDenied — có thể gặp

Xem có CD/local writer khác không, đúng role/key chưa. S3 backend cần Get/Put state và Get/Put/Delete lockfile; quyền lock ARN khác state ARN. Chờ writer hoặc xác minh lock thật sự stale trước phương án force-unlock; không xóa lock chỉ vì đang vướng. Backend S3 mới không tồn tại cần bootstrap theo RUNBOOK.

### 3.6 S3 BucketNotEmpty / prod deletion protection — có thể gặp

App bucket có versioning: xóa object hiện hành chưa xóa version/delete marker. Kiểm tra đúng bucket và backup trước quy trình destroy Dev. Prod có protection chủ đích; không tắt tự động để làm plan pass. State bucket/bootstrap phải tồn tại sau destroy Dev.

### 3.7 Tách policy.tf rồi import thế nào / đuôi .json là gì — đã hỏi trong lịch sử

Terraform tự đọc mọi file `.tf` trong cùng module; không có import file policy.tf trong main.tf. `data.aws_iam_policy_document.lambda.json` là attribute JSON do data source sinh, không yêu cầu tạo file `lambda.json`.

Policy thuộc resource của module nào thì đặt trong module đó, dùng biến module. Ví dụ `s3:ListBucketVersions` dùng bucket ARN; điều kiện `StringLike` trên `s3:prefix` giới hạn `lesson-media/*`. Object operations dùng object ARN. Hiện quyền media/Streams/SQS nằm ở [Lessons policy](../infrastructure/modules/lessons-api/policy.tf); [Catalog policy](../infrastructure/modules/catalog-api/policy.tf) chỉ có DynamoDB và CloudWatch Logs.

## 4. Cognito, tài khoản và hồ sơ

### 4.1 Admin creation failed / InvalidPasswordException — đã gặp

`create_admin.py` cố ý báo lỗi tổng quát để không làm lộ thông tin SDK/password. Sau thất bại phải kiểm tra pool/table/account đúng rồi đối chiếu user Cognito và ACCOUNT; script có compensation xóa user nếu chưa commit DB.

`UserNotFoundException` sau đó không chứng minh user chưa từng được tạo: user có thể đã bị compensation xóa. Không retry hàng loạt hoặc tạo riêng ACCOUNT/user theo phỏng đoán.

Trong lịch sử, mã lỗi cụ thể được xác định là `InvalidPasswordException`. Kiểm tra password policy hiện hành:

~~~powershell
aws cognito-idp describe-user-pool --user-pool-id $poolId --query UserPool.Policies.PasswordPolicy --profile giaoan-dev
~~~

Mặc định tối thiểu 8 ký tự, có hoa/thường/số. Nhập ẩn qua prompt; không gửi password để nhờ kiểm tra. Chỉ retry sau khi xác định trạng thái cũ.

### 4.2 Không có tài khoản để login sau dựng hạ tầng — đã gặp

Terraform không tạo user/password. Operator chạy script tạo admin; sau đó Admin cấp account cho từng giáo lý viên. Local mock không tạo user AWS.

### 4.3 Cognito login thành công nhưng API 403 — đã gặp / có thể tái diễn

Kiểm tra đúng hai thành phần: user/group trong Cognito và ACCOUNT `PK=ACCOUNT#<sub>, SK=PROFILE` trong cùng table/môi trường. ACCOUNT phải ACTIVE, role khớp group, không pending disable/archive. Với 401, kiểm tra token_use=access, client/pool/issuer và hết hạn/revocation.

Đọc claim để chẩn đoán chỉ ở local, không log raw JWT; đọc claim không thay thế xác minh JWT. Sau enable/restore/login pool mới cần session mới. Không bỏ kiểm tra ACCOUNT để làm API chạy.

### 4.4 Tạo user trên UI nhưng Cognito không có / refresh mất — đã gặp

Callback cũ chỉ cập nhật state browser và báo thành công. Luồng hiện tại có Users API; kiểm tra Network có POST account tới đúng endpoint, response/ID thật, Cognito và ACCOUNT rồi reload/login. Nếu dùng local mock, đây vẫn là dữ liệu UI fake theo thiết kế.

Editor/Reader mới cần catechistId thật. Hai hồ sơ trùng email không có nghĩa là cùng ID. Email liên hệ trong danh bạ không phải khóa để tự gán user.

### 4.5 PROFILE_ALREADY_LINKED / PROFILE_NOT_LINKED — có thể gặp

Một hồ sơ chỉ liên kết một ACCOUNT chưa DELETED; DISABLED vẫn giữ link. Account DELETED giữ reverse link trong retention nhưng restore cần kiểm tra lại quyền liên kết. Admin chọn hồ sơ đúng bằng ID, xử lý account đang giữ link hoặc gán hồ sơ khác. Không chỉnh link bằng tay trong DB để né transaction/version guard.

### 4.6 Tự cập nhật email nhưng login vẫn dùng email cũ — hành vi chủ đích

PUT profile sửa email liên hệ; Cognito email đăng nhập không đổi. Tên/role/status không được tự sửa qua route này. Nếu account cũ chưa liên kết, Admin gán hồ sơ trước.

## 5. CI/CD, OIDC và IAM

### 5.1 Frontend mới nhưng không có artifact hoặc UI vẫn cũ — đã gặp

Trigger/filter Backend cũ chỉ chạy khi Backend đổi; CD lấy toàn repo ở SHA artifact nên có thể build Frontend cũ. Source đã đổi để mỗi push main tạo Backend release.

Xác minh run event push/main, source SHA, job package đã chạy và artifact `lambda-release-<SHA>` còn hạn. Release mới phải có đúng `lessons-api.zip`, `catalog-api.zip`, `users-api.zip` và manifest có SHA-256 khớp bytes cả ba ZIP; CD từ chối thiếu/thừa ZIP hoặc sai checksum. Re-run run cũ vẫn giữ SHA cũ. Nếu artifact đã hết 30 ngày, tạo release mới từ code known-good; không sửa checksum/manifest để vượt gate.

### 5.2 Required check pending / CI skipped không như dự kiến — có thể gặp

Phân biệt workflow không trigger và job được skip có chủ đích. Kiểm tra branch/path filters, base/head SHA và output detect-changes. Script hiện đọc `DIFF_MODE` đúng như workflow truyền: PR dùng three-dot để chỉ xét thay đổi từ merge-base; push/merge group dùng two-dot. Lỗi cũ đọc nhầm `DIFF MODE` đã được sửa và có kiểm thử với hai nhánh phân kỳ. Chạy `python -m unittest discover -s scripts/ci/tests -v` từ root để kiểm tra offline. Không sửa branch protection để che lỗi filter.

### 5.3 CD checkout/script sai thứ tự hoặc YAML indentation — đã gặp

Đúng thứ tự: checkout source chứa validator → validate Backend run với step id release → checkout release SHA → tải artifact và verify. Một dòng `- name` nằm trong shell run block vẫn có thể là YAML hợp lệ nhưng shell sai. So sánh source workflow của đúng run/attempt với source trên main.

### 5.4 sts:AssumeRoleWithWebIdentity denied — đã gặp

Xem bước in `iss/aud/sub` đã lọc, role ARN và Environment thực tế. Lịch sử có subject dùng owner/repo IDs, khác mẫu branch/tên repo ban đầu. Trust phải khớp token thực tế; provider audience là sts.amazonaws.com và job cần id-token:write.

Trust policy quyết định ai assume role; permissions policy quyết định quyền sau khi assume. Sửa quyền S3/Lambda không chữa lỗi trust. [GitHub OIDC](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws).

### 5.5 API Gateway TagResource denied, IAM báo Invalid Action — đã gặp

CreateStage từng báo TagResource trong lỗi nhưng Console không chấp nhận action literal `apigateway:TagResource`; IAM API Gateway ánh xạ qua HTTP verbs. Simulator POST/PUT allowed không chứng minh mọi dependent authorization của request thật đã đủ.

Policy bổ sung lưu workaround lịch sử `apigateway:*` chỉ trên hai stage collection ARN cụ thể; log deploy sau đã qua bước này. Đây là grant chẩn đoán phạm vi resource hẹp, **không phải kết luận mọi CreateStage đều bắt buộc wildcard**. Đối chiếu API IDs/tags thật và CloudTrail/RequestID trước khi giữ/mở rộng. Source policy không tự cập nhật policy đang gắn AWS.

### 5.6 IAM simulator trả template ARN/chỉ hai result — đã gặp

Một result ngoài cùng theo action là hợp lệ; resource decisions nằm trong `ResourceSpecificResults`. ARN template ở phần tổng không tự chứng minh người chạy nhập sai. Đọc EvalResourceDecision, MatchedStatements, MissingContextValues; truyền đúng tag/region context cho condition. Simulator không thực hiện live request và không bao phủ mọi tác động boundary/SCP/service.

### 5.7 Cognito MFA config denied / pool ID thay đổi — đã gặp

Policy từng thiếu `GetUserPoolMfaConfig/SetUserPoolMfaConfig` và bản bổ sung hardcode pool ID. File hiện dùng scope account/region/tag cho các quyền này; kiểm tra tags và policy thực gắn vào deploy role.

Pool ID khác có thể do create dở/read-after-create failure hoặc replacement; phải audit state mới biết. Không cứ đổi ID trong policy mỗi retry hay xóa các pool chưa xác định dữ liệu.

### 5.8 Insufficient permissions to enable logging — đã gặp

Tạo log group thành công không đủ để API Gateway cấu hình log delivery. Lịch sử có deny `logs:CreateLogDelivery`; policy bổ sung có nhóm quyền delivery/resource policy theo region, rộng hơn log group Dev.

Kiểm tra đúng **deployment role**, IAM saved policy, region và CloudWatch resource-policy quota. Không cấp thêm quyền log delivery cho execution role để sửa nhầm tầng. [AWS HTTP API logging](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-logging.html).

### 5.9 Event source mapping thiếu lambda:TagResource — đã gặp

Function ARN không bao phủ event-source-mapping ARN. Review quyền mapping tag-on-create và request tags Project/Environment; resource tags chưa tồn tại khi create. Không bỏ Terraform default tags để vượt deny. [AWS mapping tags](https://docs.aws.amazon.com/lambda/latest/dg/tags-esm.html).

### 5.10 Content route split lỗi sau deploy

Source giữ một Content HTTP API; route lesson/note/media phải vào `giaoan-<env>-lessons-api`, còn program/reference phải vào `giaoan-<env>-catalog-api`. Nếu route trả 5xx hoặc integration lỗi, kiểm tra API Gateway access log theo `routeKey`/`integrationError`, so route map Terraform với registry Python và xác nhận Lambda permission `AllowHttpApiLessons`/`AllowHttpApiCatalog` cho đúng function. Chạy `test_terraform_routes_match_python_registry` trước khi phát hành; không sửa URL Frontend hoặc tạo API mới để chữa route target sai.

Khi gặp `AccessDenied`, xác nhận deployed source SHA và execution role: Lessons cần DynamoDB, stream read, SQS send và S3 trong `lesson-media/*`; Catalog chỉ cần DynamoDB table/index và CloudWatch Logs. Không cấp thêm quyền S3/Streams/SQS cho Catalog. Nếu plan báo thiếu quyền IAM của CD, đối chiếu allowlist cho cả hai role/function mới và giữ quyền cần thiết để xóa role/function `content-api` cũ trong cutover.

Kiểm tra chỉ có một MEDIA stream mapping đang chạy trên Lessons, filter là `REMOVE` với `OldImage.PK` prefix `MEDIA#`; Users tiếp tục nhận `ACCOUNT#`. Failure queue media vẫn có tên vật lý `*-content-api-stream-failures` và được `moved` trong Terraform để giữ message. Nếu plan muốn thay queue, xóa queue hoặc để hai MEDIA consumer chạy đồng thời, dừng trước apply và review state/plan.

Nếu apply báo `ConflictException: Cannot delete Integration because it is referenced by Routes`, dùng revision mới nhất có `moved` block chuyển integration cũ sang `aws_apigatewayv2_integration.lambda["lessons"]`, sau đó tạo plan mới. Không xóa integration hoặc route thủ công. Apply có thể đã hoàn tất một phần trước lỗi; kiểm tra state và plan mới trước khi chạy lại.

Nếu `iam:CreateRole` bị `AccessDenied`, policy trong repo đã có action này trong `ManageDevExecutionRoles` với ARN giới hạn cho role `content-api`, `lessons-api`, `catalog-api` và `users-api`. Kiểm tra policy thực tế đang gắn vào GitHub CD role, resource ARN, permissions boundary và SCP; cập nhật policy thực tế theo file đã review rồi chạy lại. Không mở rộng sang `iam:*` hoặc `Resource: "*"`.

### 5.10 Sửa policy vẫn deny / apply lỗi giữa chừng — có thể gặp

Xác minh Save vào đúng role, request mới, action/resource/region/tags, boundary/SCP và CloudTrail nếu được ghi. Không mặc định do propagation. Local policy JSON, simulator và AWS policy thực tế là ba bằng chứng khác nhau.

Apply có thể đã đổi Backend trong khi Frontend build/upload thất bại. Ghi step đầu/cuối, state và release identity; tạo plan mới sau khi sửa hoặc rollback có review. Toàn release chưa được coi là thành công khi mới qua một lỗi.

## 6. Frontend, persistence và rich text

### 6.1 Lưu tài liệu/chương trình/giáo án rồi refresh mất — đã gặp

Lịch sử có các màn hình chỉ setState. Hiện cần xác định đang chạy mock hay API thật, source SHA nào và endpoint nào. Network phải có create/save thành công, có server ID/version; reload phải GET lại management detail/list. Reader không thấy DRAFT là đúng hành vi, cần publish.

Nếu request lỗi, giữ nội dung đang nhập, lấy requestId/code và sửa nguyên nhân; không báo success sớm. Tiếp tục kiểm chứng DB sau deploy đúng cả Backend/Frontend, không chỉ sửa một phía.

### 6.2 Marks không hợp lệ khi lưu nháp — đã gặp

Định dạng qua selection có hardBreak/image có thể gắn marks lên inline node đó. Validator hiện cho marks hợp lệ trên các inline node, vẫn giữ allowlist. Kiểm tra revision source/ZIP Backend và payload TipTap sau serialize; không tắt toàn bộ validator.

### 6.3 Cỡ chữ không hợp lệ khi lưu chương trình — đã gặp

`textStyle.fontSize` null/chuỗi rỗng là mặc định; validator hiện chuẩn hóa chuỗi rỗng. Giá trị rõ ràng chỉ nhận 12/14/16/18/20/24/28/32px. Kiểm tra payload paste/import có `pt`, giá trị lạ hoặc fontFamily ngoài allowlist. Đồng bộ UI/serializer/validator, kiểm tra save/reload của lịch chương trình chứ không chỉ giáo án.

### 6.4 Toolbar hiện cỡ chữ của selection trước / không áp lại được — đã gặp

Đối chiếu selection state và transaction editor, thuộc tính toolbar phải cập nhật theo selection mới. Nghiệm thu cả chọn lại cùng cỡ chữ, multi-selection, soft break và save/reload. Ghi nhận source/release nếu hành vi cũ trở lại, không sửa backend schema để chữa toolbar state.

### 6.5 Gõ 1. / - / * / + rồi Space bị biến mất — đã gặp

TipTap input rules từng tự chuyển thành list. Source UI đã điều chỉnh giữ ký tự đầu dòng theo yêu cầu người dùng. Nếu lỗi tái diễn, kiểm tra extension/input rules và cached frontend SHA; không thay đổi dữ liệu đã lưu để chữa hành vi lúc nhập.

### 6.6 Bảng/cột/màu ô bị từ chối hoặc lệch — có thể gặp

Rich-text table/columns phải đúng schema và ô gộp không chồng lấn. Font/color là textStyle; nền ô lịch chương trình dùng `cellBackgrounds` theo column ID, không tự thêm backgroundColor vào mark. Kiểm tra dữ liệu paste, đồng bộ phiên bản extension/validator, giới hạn 200 KiB và số hàng/cột. Độ rộng float của cột cần được chuẩn hóa trước DynamoDB.

### 6.7 Ảnh upload/save/GET lỗi — có thể gặp

Kiểm tra thứ tự đã tạo lessonId thật → URL upload → PUT hoàn tất → save/publish, đúng MIME/bytes và bucket versioning. ID tạm browser/ảnh bài khác không được gắn. Chỉ JPEG/PNG/WebP ≤5 MiB.

Presigned PUT hết 5 phút: xin lại theo luồng upload. GET hết 15 phút: đọc lại chi tiết để nhận URL mới. Không lưu URL có hạn vào DB và không mở public bucket/CloudFront media để chữa 403.

Ảnh bỏ khỏi DRAFT nhưng PUBLISHED còn dùng vẫn được giữ. TTL cleanup không tức thì; xem mục 7.

### 6.8 Frontend config/CORS/CloudFront 403/404 — có thể gặp

- API URL/pool/client là build-time config; sửa env trên máy sau khi đã upload không thay JS trên S3.
- Origins phải đúng scheme/host/port, không path; xem preflight status và lỗi API thật. S3 CORS và Gateway CORS là hai cấu hình.
- Hosting origin path là /frontend, CloudFront Function rewrite extensionless sang .html. Kiểm tra file export tương ứng, OAC và bucket policy; không đổi sang public S3 website để né lỗi.
- Code mới không hiện: đối chiếu SHA trước, sau đó kiểm tra upload đúng bucket/prefix, distribution và invalidation đã complete. Old cached tabs có thể giữ HTML/JS cũ.

### 6.9 Lỗi 409 khi save hoặc thao tác account — có thể gặp

Version cũ do tab khác thay đổi: giữ bản đang nhập, tải state mới và đối chiếu; không tăng version thủ công rồi ghi đè. Với account pending action, đợi lease 120 giây và retry cùng endpoint. Mất HTTP response không chứng minh transaction thất bại.

### 6.10 Note không hiện / không tạo được — có thể gặp

Phải ở bản PUBLISHED, selection trong cùng field hỗ trợ, đúng account và note quota. Đổi nội dung bài có thể làm anchor mất vị trí; note vẫn ở danh sách riêng. Không tìm note bằng GSI hay owner từ request.

Nếu không sửa được hồ sơ cá nhân, kiểm tra catechistId liên kết. Nếu người dùng đổi account giữa lúc request cũ trả về, giữ cơ chế session-version/owner scoping; không để 401 của phiên cũ logout phiên mới.

### 6.11 Font tiếng Việt/test glyph hoặc Google Fonts build lỗi — đã gặp

Lịch sử có lỗi glyph Be Vietnam Pro/Fraunces/Playfair Display và lỗi mạng tới fonts.googleapis.com. Đây là hai quan sát khác nhau, chưa chứng minh mọi lỗi glyph đều do mạng.

Kiểm tra subsets Vietnamese, font build/cache, proxy/mạng và output CSS. Test bị skip khi thiếu build không chứng minh glyph đúng. Nếu cần cô lập cache, dừng server/build và chỉ di chuyển cache .next trong workspace đã xác minh; không xóa cả repo. Self-host font là cải tiến cần giấy phép phù hợp.

## 7. Dữ liệu xóa, SQS và hiệu năng

### 7.1 Bấm xóa nhưng DynamoDB/ảnh vẫn còn — đã hỏi trong lịch sử

Archive ẩn dữ liệu ngay và đặt purgeAt sau 10 ngày. TTL xóa vật lý bất đồng bộ, có thể muộn hơn hạn; Streams cleanup ngoại vi chạy sau đó. Upload chưa gắn có TTL 1 ngày. Không diễn giải “10 ngày” thành lịch hẹn xóa chính xác.

Kiểm tra status/purgeAt, còn revision nào tham chiếu ảnh không, IteratorAge, mapping filter và failure queue. Restore/recreate có guard chống event cũ xóa tài nguyên mới.

### 7.2 Ai đọc dữ liệu fail trong SQS? — đã hỏi trong lịch sử

Hiện **không có consumer SQS replay tự động**. Hai queue nhận stream invocation thất bại sau giới hạn retry/age; alarm để operator điều tra. Message có metadata shard/sequence, không phải đảm bảo giữ đầy đủ OldImage.

SQS retention 14 ngày không kéo dài Streams retention 24 giờ. Không purge/delete queue message hoặc replay handler trước khi xác định item hiện tại, bản restore, object versions và Cognito user đúng. Quy trình phản hồi ở MONITORING.

### 7.3 Cold start/request đầu lớn — người dùng báo ngày 20/10/2026

Chưa thu được baseline Dev vì profile AWS chưa có trong môi trường triển khai này; chưa có số đo chứng minh split cải thiện cold start. Source đã tách route/handler/package/Terraform thành Lessons và Catalog nhưng chưa xác nhận apply AWS. Lessons nạp media handler lười cho stream; Catalog không đóng gói media, S3 hay stream. Cả hai vẫn memory 256 MB; một số SDK client tạo trong request và catalog vẫn đọc lại nhiều item.

Đo Init Duration, Duration cold/warm, browser timing và số lần gọi DB/S3. Import lần đầu bên trong handler sẽ nằm trong Duration; chậm lần đầu không phải toàn bộ đều là INIT. ZIP local từng được kiểm tra khoảng 16,6 MB, phần lớn là botocore; đây không phải số đo artifact đang deploy.

Không khẳng định hiệu quả latency cho tới khi ghi baseline trước cutover, deploy được review và đo lại cùng workload trên Lessons/Catalog. Tách Lambda có thể làm chức năng ít truy cập có môi trường warm riêng; benchmark client reuse/memory/package và thuật toán catalog riêng. Note vẫn nằm trong Lessons; không kết luận tách note riêng sẽ tự giảm độ trễ. Xem truy vấn trong MONITORING.

### 7.4 Test offline bất ngờ gọi AWS — đã gặp

Baseline Backend từng fail vì test patch `shared.db.Store` trong khi auth giữ binding `shared.auth.Store`. Đã có sửa parse groups và mock đúng namespace. Khi tái diễn, tìm binding/dependency bị lọt; không cấp credentials thật hoặc mở mạng để làm unit test pass. Số pass của ledger cũ là lịch sử, phải chạy lại suite phù hợp.

## 8. Ghi một sự cố mới

~~~text
Thời điểm / môi trường / SHA:
Nguồn: báo cáo người dùng, log thật, hay tái hiện local:
Triệu chứng và tác động:
Request ID / workflow run / attempt:
Bằng chứng đã lọc:
Nguyên nhân đã xác nhận:
Giả thuyết còn lại:
Thay đổi cụ thể / cách phục hồi:
Kiểm chứng sau sửa:
Việc còn lại / đánh đổi / người theo dõi:
~~~

Nguồn lịch sử gốc: [CI/CD runbook cũ](archive/infrastructure/RUNBOOK-CICD.md), [Dev runbook cũ](archive/infrastructure/environments/dev/DEV-RUNBOOK.md), [ledger hồ sơ/note](archive/docs/superpowers/plans/personal-profiles-ledger.md). Không chạy lệnh hoặc chép ID lịch sử từ archive vào môi trường hiện tại.
