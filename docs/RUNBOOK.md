# Runbook phát triển và triển khai

Đối chiếu source ngày **20/10/2026**. Đọc [CONTEXT](CONTEXT.md) trước. Khi lỗi dùng [TROUBLESHOOTING](TROUBLESHOOTING.md); sau release theo [MONITORING](MONITORING.md).

## 1. Chọn đúng quy trình

| Nhu cầu | Đường đi |
| --- | --- |
| Chạy hoặc sửa giao diện local | Mục 2 |
| Dựng môi trường AWS lần đầu | Mục 3–5 |
| Phát hành code đã lên main | Mục 6, ưu tiên CI/CD |
| Deploy thủ công có chủ đích | Mục 4 và 7 |
| Nghiệm thu | Mục 8 |
| Retry/rollback/promote Prod | Mục 9 |
| Xóa và dựng lại Dev | Mục 10; đây là thao tác mất dữ liệu |

Các đoạn PowerShell mặc định chạy tại **root repository**, không chạy từ Backend/scripts hoặc infrastructure/environments rồi giữ nguyên đường dẫn root trong lệnh.

Các block dùng chung biến `repoRoot, infra, expectedAccountId` được thiết lập ở mục 2–3. Nếu mở terminal mới, thiết lập lại các biến và xác nhận identity trước khi tiếp tục; không chạy riêng block apply/destroy với biến chưa kiểm tra.

## 2. Chuẩn bị và chạy local

Công cụ: Git, Python 3.12, Node 22.13.0, pnpm 12.3.4, Terraform 1.15.0, AWS CLI v2. GitHub CLI tùy chọn. Dùng phiên bản/lockfile của repo thay vì tự nâng lên latest giữa lúc xử lý sự cố.

~~~powershell
Set-Location E:\FCAJ\giaoan-web
$repoRoot = (Get-Location).Path
if (-not (Test-Path 'Frontend/package.json') -or -not (Test-Path 'Backend/requirements.txt')) {
  throw 'Chưa đứng tại root repository'
}
git status --short
node --version
terraform version
aws --version
~~~

### Python và kiểm thử Backend

Nếu chưa có virtualenv, tạo bằng Python 3.12 đã cài. Ví dụ trên Windows có Python launcher:

~~~powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r Backend/requirements-dev.txt
Push-Location Backend
try {
  ..\.venv\Scripts\python.exe -m pytest -q
} finally {
  Pop-Location
}
~~~

Nếu `py` không tồn tại, cài Python 3.12 hoặc dùng đường dẫn tuyệt đối tới interpreter đã cài. `.tools/` và `.venv/` là công cụ local bị Git ignore, không được giả định có trên máy cộng sự. Dấu `(.venv)` ở prompt không thay đổi thư mục làm việc; nó chỉ kích hoạt môi trường.

Tests Backend dùng fake/moto, không cần AWS credentials thật và không chứng minh IAM/CORS/deployment AWS. Conftest đặt credentials thử và chặn EC2 metadata lookup. Không cấp credentials thật để làm test offline pass.

### Frontend

~~~powershell
npm install --global pnpm@12.3.4
Push-Location Frontend
try {
  pnpm install --frozen-lockfile
  if (-not (Test-Path '.env.local')) { Copy-Item '.env.example' '.env.local' }
} finally {
  Pop-Location
}
~~~

Sửa `Frontend/.env.local` theo mục 5. Nếu chỉ thiết kế UI bằng account fake, bật `NEXT_PUBLIC_ENABLE_LOCAL_AUTH_MOCK=true` và dùng email/password fake do chính file env cấu hình. Mock chỉ chạy với `next dev`; quyền fake hiện là admin. Các màn hình mock không kiểm chứng dữ liệu AWS đã lưu.

~~~powershell
Push-Location Frontend
pnpm dev
# Hoặc npm run dev; cả hai gọi cùng script "dev".
~~~

Mở `http://localhost:3000`. Dừng dev server bằng Ctrl+C rồi `Pop-Location` để về root. Khi sửa env phải khởi động lại dev server.

Kiểm tra Frontend khi thay đổi liên quan:

~~~powershell
Push-Location Frontend
try {
  pnpm test
  pnpm exec tsc --noEmit
  pnpm build
} finally {
  Pop-Location
}
~~~

`npm run dev`/`npm run build` dùng được với dependencies đã cài bằng pnpm; không tạo thêm package-lock hoặc thay lockfile chỉ để chạy script. Build dùng next/font/google nên cần mạng tới nguồn font. `npm run start` gọi next start, không dùng để phục vụ static export này.

Hai kiểm thử browser tùy công việc: `npm run test:content-ui` và `npm run test:personal-ui`, chạy từ Frontend sau build. Cần Chrome và virtualenv Python có dependency test; có thể cấu hình `CONTENT_TEST_CHROME/CONTENT_TEST_PYTHON` theo runner. Runner dùng port/profile tạm, backend giả trong memory và chặn request ngoài, không kiểm chứng AWS thật.

## 3. AWS identity, state và cấu hình môi trường

### Profile local

Lấy tên thật từ danh sách; trong lịch sử dự án profile đúng là `giaoan-dev`, không phải `giaoan_dev`.

~~~powershell
aws configure list-profiles
$env:AWS_PROFILE = 'giaoan-dev'
$env:AWS_DEFAULT_PROFILE = 'giaoan-dev'
$env:AWS_REGION = 'ap-southeast-1'
$env:AWS_DEFAULT_REGION = 'ap-southeast-1'

# Chỉ bỏ bộ access keys của shell nếu muốn chuyển sang named profile.
Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY, Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
aws configure list
aws sts get-caller-identity
if ($LASTEXITCODE -ne 0) { throw 'AWS identity chưa hợp lệ' }

$expectedAccountId = '<DEV_ACCOUNT_ID_DA_XAC_NHAN>'
$infra = Join-Path $repoRoot 'infrastructure/environments/dev'
~~~

Đối chiếu Account/Arn với môi trường định thao tác; không lấy một account sai rồi coi nó là expected. Với SSO, chạy `aws sso login --profile giaoan-dev` khi phiên hết hạn. Trong CloudShell dùng phiên Console, thường không truyền profile local.

### State

Bucket hiện được cấu hình: `gxthaian-giaoan-web-2026`, region `ap-southeast-1`.

| Root | Key |
| --- | --- |
| bootstrap | `giaoan-web/bootstrap/terraform.tfstate` |
| dev | `giaoan-web/dev/terraform.tfstate` |
| prod | `giaoan-web/prod/terraform.tfstate` |

S3 backend dùng `use_lockfile=true`, lock ở `<key>.tflock`. App table không dùng làm lock table. Không chuyển state giữa ba key hoặc dùng workspace để trộn các environment root này.

Nếu bucket/state đã có, dùng cấu hình hiện có và init, không tạo lại bootstrap. Nếu bucket mới hoàn toàn:

1. Chọn tên bucket state thuộc account của bạn và còn trống toàn cục. Đồng bộ tên trong các `backend.tf` và `bootstrap/terraform.tfvars` trước.
2. Tạo thư mục bootstrap local riêng, chỉ copy `main.tf, variables.tf, providers.tf, versions.tf` và tfvars đã review; **chưa copy backend.tf**. Chạy init/plan/apply bằng local state để Terraform tạo bucket, public access block, ownership, encryption và versioning.
3. Sau khi bucket tồn tại, copy `bootstrap/backend.tf` vào thư mục đó; chạy `terraform init -migrate-state` và xác nhận chuyển đúng local state tới bootstrap key.
4. Kiểm tra remote bootstrap state list có các resource vừa tạo. Sau đó dùng lại root bootstrap của repo với `terraform init -reconfigure`, kiểm tra không đề xuất tạo lại bucket.
5. Giữ bản local state an toàn cho tới khi xác minh migration; không commit state. Đây là bootstrap một lần, không phải bước của mỗi release.

`terraform init -backend=false` chỉ phù hợp kiểm tra cấu hình offline; không tạo bucket và không chứng minh remote state/IAM hoạt động.

### tfvars

Copy example một lần, không ghi đè file đang có:

~~~powershell
if (-not (Test-Path "$infra/terraform.tfvars")) {
  Copy-Item "$infra/terraform.tfvars.example" "$infra/terraform.tfvars"
}
~~~

Ví dụ Dev:

~~~hcl
aws_region = "ap-southeast-1"
project_name = "giaoan"
environment = "dev"
allowed_origins = ["http://localhost:3000"]
log_retention_days = 14
notification_email = "operator@example.com"
budget_email = "billing@example.com"
monthly_budget_usd = 10
~~~

Email là ví dụ cần thay. CloudFront/custom origin được tự thêm; `allowed_origins` chỉ thêm origin chính xác, không path/wildcard. Không lưu AWS keys/password ở tfvars.

`notification_email` tạo subscription SNS cần xác nhận email. Budget chỉ được tạo khi có `budget_email`; budget cảnh báo, không tự chặn chi phí. Kích hoạt cost allocation tag `Environment` nếu dùng budget lọc theo tag.

Custom domain là tùy chọn: frontend certificate có sẵn ở us-east-1, API certificate ở aws_region, Route53 zone có sẵn nếu muốn alias tự tạo. Có thể dùng hostname mặc định AWS. Policy CD mẫu chưa chắc đủ cho các tùy chọn ACM/Route53/Budget/SNS này.

## 4. Package và triển khai hạ tầng thủ công

Từ root, tạo ZIP trước khi Terraform đọc `filebase64sha256`:

~~~powershell
.\.venv\Scripts\python.exe Backend/scripts/package_lambdas.py
if ($LASTEXITCODE -ne 0) { throw 'Package Lambda thất bại' }
Test-Path Backend/dist/lessons-api.zip
Test-Path Backend/dist/catalog-api.zip
Test-Path Backend/dist/users-api.zip

terraform "-chdir=$infra" init -reconfigure
if ($LASTEXITCODE -ne 0) { throw 'Terraform init thất bại' }
terraform "-chdir=$infra" validate
if ($LASTEXITCODE -ne 0) { throw 'Terraform validate thất bại' }
terraform "-chdir=$infra" plan "-out=dev.tfplan"
if ($LASTEXITCODE -ne 0) { throw 'Terraform plan thất bại' }
terraform "-chdir=$infra" show dev.tfplan
~~~

Quote toàn bộ `-out=dev.tfplan` để tránh PowerShell tách tham số. Đọc kỹ creation/update/replacement/deletion, account, region và state. Sửa UI bình thường không nên thay User Pool/table/app bucket. Sau khi đã review chính saved plan đó:

~~~powershell
terraform "-chdir=$infra" apply dev.tfplan
if ($LASTEXITCODE -ne 0) { throw 'Apply chưa hoàn tất; xem state trước khi retry' }
terraform "-chdir=$infra" output
~~~

`No changes` nghĩa là plan không thấy đổi hạ tầng; không cần destroy. Frontend vẫn có thể cần build/upload mới. Với `init -backend=false` đã chạy trong root này, phải init thật/reconfigure trước thao tác remote.

Khi chuyển từ content-api cũ sang hai Lambda, xem plan trước khi apply: Content HTTP API ID/stage/domain/authorizer, DynamoDB table, S3 bucket, Cognito và Users API phải được giữ. Queue media phải được chuyển địa chỉ state sang Lessons nhưng giữ nguyên tên vật lý `*-content-api-stream-failures`; stream chỉ có một MEDIA consumer là Lessons. Lambda/IAM cũ content-api được thay bằng Lessons/Catalog, còn log group Lambda cũ được giữ làm legacy. Dừng và không apply nếu plan xóa/thay bảng, queue, API hoặc tài nguyên stateful ngoài dự kiến. Split không cần migration dữ liệu DynamoDB.

Package script tạo ba ZIP `lessons-api.zip`, `catalog-api.zip`, `users-api.zip` gồm package domain tương ứng + shared + runtime dependencies đã pin; không chứa docs/tests/password. Terraform mặc định đọc hai biến tùy chọn `lessons_lambda_zip_path` và `catalog_lambda_zip_path` cùng `users_lambda_zip_path` từ `Backend/dist/`. Nếu `terraform.tfvars` cũ còn `content_lambda_zip_path`, bỏ biến cũ và chỉ thêm override cho đường dẫn mới khi cần. Sửa Python cần package/deploy lại; Terraform không tự build code.

## 5. Frontend config và admin đầu tiên

### Mapping outputs

| Terraform output name | Frontend env / mục đích |
| --- | --- |
| `user_pool_id` | `NEXT_PUBLIC_COGNITO_USER_POOL_ID` |
| `app_client_id` | `NEXT_PUBLIC_COGNITO_CLIENT_ID` |
| `content_api_endpoint` | `NEXT_PUBLIC_CONTENT_API_URL` |
| `users_api_endpoint` | `NEXT_PUBLIC_USERS_API_URL` |
| aws_region trong tfvars/provider | `NEXT_PUBLIC_AWS_REGION`; mặc định ap-southeast-1 |
| `app_bucket_name` | Đích upload frontend và media; không phải tên output do bạn tự đặt |
| `table_name` | Tạo admin/đối chiếu DB |
| `lessons_stream_failure_queue_url` | Queue lỗi cleanup media; `content_stream_failure_queue_url` là alias tương thích |
| `cloudfront_distribution_id` | Chờ deployment và tạo invalidation |
| `frontend_url` | URL website có thể là custom domain |
| `cloudfront_domain_name` | Domain distribution AWS |

Ví dụ lấy giá trị:

~~~powershell
$poolId = terraform "-chdir=$infra" output -raw user_pool_id
$tableName = terraform "-chdir=$infra" output -raw table_name
$bucket = terraform "-chdir=$infra" output -raw app_bucket_name
if ($LASTEXITCODE -ne 0) { throw 'Không lấy được outputs' }
~~~

Lệnh nhận **output name** `app_bucket_name`, không nhận giá trị kiểu `giaoan-dev-app-...`. Output mới chỉ có trong state sau apply phù hợp; không destroy để lấy output.

Với API thật, đặt `NEXT_PUBLIC_ENABLE_LOCAL_AUTH_MOCK=false`. Public env được nhúng vào JS lúc build. Không đưa access keys, client secret, mật khẩu thật vào `NEXT_PUBLIC_*`.

### Admin

Terraform không tạo user. Từ root:

~~~powershell
.\.venv\Scripts\python.exe Backend/scripts/create_admin.py --pool-id $poolId --table-name $tableName --email "admin@example.com" --expected-account-id $expectedAccountId --profile giaoan-dev
~~~

Thay email ví dụ trước khi chạy. Script xác minh account, hiển thị pool/table, yêu cầu gõ `CREATE ADMIN` và nhập password ẩn hai lần. Password hiện tối thiểu 8 ký tự, có chữ hoa, chữ thường, chữ số; symbols không bắt buộc. Password không truyền trên command line.

Script tạo user Cognito, permanent password, group admin và ACCOUNT DynamoDB. Nếu báo lỗi, đối chiếu cả hai nơi trước retry vì compensation hoặc một write timeout có thể tạo trạng thái dở dang.

Các tài khoản Reader/Editor sau đó: tạo hồ sơ giáo lý viên → Admin cấp account và chọn đúng catechistId. Không tạo user qua Console rồi bỏ qua ACCOUNT. Không có account local fake nào đăng nhập được AWS.

## 6. Thiết lập và dùng CI/CD

### Thiết lập một lần

1. IAM OIDC provider `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`; dùng lại provider nếu đã có.
2. Tạo deployment role riêng cho dev/prod. Trust scope đúng repository + Environment; job dùng Environment có subject khác job theo branch.
3. Đọc bước `Show OIDC identity for trust policy diagnosis` để lấy `iss/aud/sub` thực tế. Có môi trường GitHub dùng owner/repo IDs trong subject; không tự chép subject từ mẫu theo trí nhớ.
4. Review [policy chính](../infrastructure/iam/cd-dev-policy.json) và [policy bổ sung](../infrastructure/iam/cd-dev-additional-permissions.json) trước khi áp dụng. Chúng chứa account/resource IDs và grant chẩn đoán lịch sử; không phải policy tự dùng cho account khác. Sửa file Git không tự cập nhật IAM đang gắn.
5. GitHub Settings → Environments: tạo `dev`; giới hạn branch main. Tạo `prod` với role/secret độc lập và reviewer nếu phù hợp.

| GitHub Environment setting | Loại |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | Variable |
| `AWS_ACCOUNT_ID` | Variable |
| `TFVARS_JSON` | Secret, JSON hợp lệ cho đúng root |

Ví dụ secret (thay cấu hình thực tế):

~~~json
{"aws_region":"ap-southeast-1","project_name":"giaoan","environment":"dev",
 "allowed_origins":[],"monthly_budget_usd":10}
~~~

Không override đường dẫn ZIP trong secret CD, không đặt access keys/password. OIDC cấp credentials ngắn hạn. `id-token: write` cho phép xin token; quyền sửa AWS do IAM quyết định.

### Phát hành

1. Merge/push code đã review lên main; ghi source SHA và bản tốt trước.
2. Backend CI của **push main** phải success và có artifact `lambda-release-<SHA>` gồm ba ZIP (`lessons-api.zip`, `catalog-api.zip`, `users-api.zip`) + release-manifest.json. Artifact giữ 30 ngày; CI push main tạo release cả khi chỉ thay UI/docs.
3. Xác nhận Frontend/Terraform CI liên quan thực sự chạy và đạt; CD chưa tự gate toàn bộ workflow CI độc lập.
4. Actions → `CD-DEV Pipeline` → Run workflow; branch main, environment dev, backend_run_id là **run ID trong URL Actions**, operation plan.
5. Đọc plan. Đổi run ID chỉ chọn release source/artifact, không tự quyết định tạo hay thay tài nguyên.
6. Tạo run mới cùng backend_run_id/environment, operation deploy. Deploy **tạo plan mới rồi apply plan trong chính run đó**; không dùng saved plan của run plan trước.
7. Theo dõi hết apply → Frontend test/typecheck/build → upload → CloudFront wait/invalidation → smoke → summary. Apply xanh chưa chứng minh release hoàn tất.

CD checkout đúng toàn repo theo SHA artifact, kiểm tra manifest/checksum, build Frontend bằng outputs thật. Backend ZIP đã được CI đóng gói, không cần người vận hành zip thủ công khi deploy theo CD. Nếu secret `TFVARS_JSON` còn `content_lambda_zip_path`, xóa key đó; chỉ đặt các override ZIP mới khi không dùng `Backend/dist/` mặc định. Frontend artifact CI dùng public config placeholder, không phải output đem thẳng lên AWS.

CD chờ `distribution-deployed` rồi `invalidation-completed`, sau đó summary trả frontend URL và CloudFront URL. Concurrency theo môi trường không tự ngăn một operator chạy local apply; remote state lock vẫn cần.

## 7. Build và upload Frontend thủ công

Chỉ dùng khi chọn deploy thủ công; làm theo cùng SHA/config với Backend. Từ root, sau khi `.env.local` đã khớp outputs:

~~~powershell
$bucket = terraform "-chdir=$infra" output -raw app_bucket_name
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($bucket)) { throw 'Bucket output không hợp lệ' }
$distributionId = terraform "-chdir=$infra" output -raw cloudfront_distribution_id
if ($LASTEXITCODE -ne 0) { throw 'Distribution output không hợp lệ' }
$frontendUrl = terraform "-chdir=$infra" output -raw frontend_url
if ($LASTEXITCODE -ne 0) { throw 'URL output không hợp lệ' }

Push-Location Frontend
try {
  pnpm build
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path out/index.html)) { throw 'Build export thất bại' }
} finally {
  Pop-Location
}

aws s3 sync Frontend/out/ "s3://$bucket/frontend/" --exclude '*' --include '_next/static/*' --cache-control 'public,max-age=31536000,immutable'
if ($LASTEXITCODE -ne 0) { throw 'Upload static assets thất bại' }
aws s3 sync Frontend/out/ "s3://$bucket/frontend/" --exclude '_next/static/*' --cache-control 'no-cache'
if ($LASTEXITCODE -ne 0) { throw 'Upload frontend thất bại' }
aws cloudfront wait distribution-deployed --id $distributionId
if ($LASTEXITCODE -ne 0) { throw 'CloudFront chưa deployed' }
$invalidationId = aws cloudfront create-invalidation --distribution-id $distributionId --paths '/*' --query Invalidation.Id --output text
if ($LASTEXITCODE -ne 0) { throw 'Không tạo được invalidation' }
aws cloudfront wait invalidation-completed --distribution-id $distributionId --id $invalidationId
if ($LASTEXITCODE -ne 0) { throw 'Invalidation chưa hoàn tất' }
$frontendUrl
~~~

Luôn upload vào `frontend/`, giữ old hashed assets cho các tab còn mở; không chạy sync --delete toàn bucket. Build local chỉ sinh out, không tự upload. Sửa `output: 'export'` hoặc public env chỉ cần build/deploy Frontend, không cần destroy hạ tầng.

## 8. Nghiệm thu sau deploy

Smoke test trong CD chỉ kiểm tra homepage HTTP 200 và API thiếu token HTTP 401. Cần kiểm tra nghiệp vụ bằng account Dev:

- Reader/editor/admin đăng nhập đúng pool; Reader không sửa nội dung, Editor không quản lý account.
- Tạo/save giáo án, chương trình và tài liệu tham khảo; reload vẫn còn. Publish rồi dùng Reader xác minh bản mới; draft chưa publish không lộ.
- Stale version trả 409 và giữ nội dung đang nhập; archive/restore và thùng rác hoạt động trong retention.
- Upload ảnh vào lesson thật, save/publish/reload; ảnh private qua signed GET, CloudFront không đọc được lesson-media. Lưu lại không mang src/signed URL vào DB.
- Tạo hồ sơ rồi cấp account; Cognito có user, DynamoDB có ACCOUNT, refresh danh sách và login được.
- Hai account khác nhau không nhìn thấy note của nhau; update contact hiện trong danh bạ nhưng login email không đổi.
- Disable/archive account đang có JWT rồi gọi API phải bị từ chối; enable/restore cần login lại.
- Header/theme, toolbar, cột/bảng, màu ô, font và ảnh hoạt động trên desktop/mobile; kiểm tra print nếu thay layout.
- Kiểm tra log/alarms/failure queues theo MONITORING; xác nhận SNS subscription.

Ghi release record: environment, SHA, Backend CI run, CD run/attempt, người thao tác, thời điểm, thay đổi, resource replacement/deletion, kết quả nghiệm thu và bản tốt trước. Không ghi credentials/body nhạy cảm.

## 9. Retry, rollback và Prod

Apply dở có thể đã tạo/cập nhật resource. Đọc log và state, tạo plan mới sau khi sửa nguyên nhân; không destroy để thử lại. Resource tồn tại ngoài state cần đối chiếu/import có review.

Re-run giữ source SHA cũ, không lấy code mới chỉ vì đã push. Nếu workflow/policy/config đã thay đổi, chọn run/attempt và release phù hợp; xem TROUBLESHOOTING.

Rollback code: chọn Backend artifact known-good còn hạn, chạy plan rồi deploy cùng quy trình, kiểm tra tương thích schema/API/infra. CD checkout toàn source SHA nên rollback có thể đổi cả Terraform, không chỉ ZIP. Nếu artifact hết hạn, khôi phục code có review thành commit mới rồi CI tạo release mới; không sửa manifest/checksum để giả artifact.

Rollback code không khôi phục dữ liệu đã mất. DynamoDB PITR/backup phục hồi sang table mới; cần verify rồi chuyển wiring có kế hoạch. S3 versioning và dữ liệu Cognito là phần khôi phục độc lập.

Prod: dùng `infrastructure/environments/prod`, Environment/role/state/config riêng. Kiểm tra deletion protection/PITR, domain/cert, notification/budget, IAM và tính tương thích sau nghiệm thu Dev. Việc workflow có input prod không chứng minh prod đã được cấu hình hoặc nghiệm thu.

## 10. Destroy và dựng lại Dev

Destroy Dev xóa pool/users, table, API/Lambda, CloudFront, app bucket và các resource Dev trong state. Đây không phải cách cập nhật giao diện hoặc lấy outputs. Quy trình dưới đây là hướng dẫn thao tác, không phải lệnh chạy tự động.

1. Xác nhận lại account/region/profile và `$infra` trỏ chính xác root Dev. Kiểm tra backend key không phải bootstrap/prod.
2. Lấy outputs/state list. Backup DB và media nếu cần; export/thống kê user không thể lấy lại mật khẩu Cognito.
3. Backup DynamoDB on-demand và chờ trạng thái AVAILABLE trước khi tiếp tục nếu cần bảo toàn dữ liệu. Dev mặc định không bật PITR.

~~~powershell
terraform "-chdir=$infra" output
terraform "-chdir=$infra" state list
$tableName = terraform "-chdir=$infra" output -raw table_name
$bucket = terraform "-chdir=$infra" output -raw app_bucket_name
aws dynamodb create-backup --table-name $tableName --backup-name "dev-before-destroy-$(Get-Date -Format yyyyMMdd-HHmmss)"
~~~

4. Trong S3 Console chọn đúng **app bucket** lấy từ output → Empty, kiểm tra và xác nhận xóa mọi object version/delete marker. Thao tác này không hoàn tác được. Không làm trống bucket state.
5. Tạo và đọc destroy plan. Chỉ áp dụng nếu toàn bộ thay đổi đúng tài nguyên Dev cần xóa:

~~~powershell
terraform "-chdir=$infra" plan -destroy "-out=dev-destroy.tfplan"
if ($LASTEXITCODE -ne 0) { throw 'Destroy plan thất bại' }
terraform "-chdir=$infra" show dev-destroy.tfplan
# Dừng ở đây để review plan; khi đã xác nhận đúng:
terraform "-chdir=$infra" apply dev-destroy.tfplan
~~~

6. Nếu bucket còn version/delete marker, giải quyết đúng bucket rồi lập plan mới. Giữ nguyên state bucket/bootstrap để quản lý lần dựng tiếp.
7. Dựng lại theo mục 4–8: package, plan/apply, lấy pool/client/API/distribution mới, cấu hình lại Frontend, tạo admin, build/upload và nghiệm thu. Không dùng out hoặc token của pool cũ.

## 11. Nguồn thực thi

[Backend CI](../.github/workflows/ci-backend.yml), [Frontend CI](../.github/workflows/ci-frontend.yml), [Terraform CI](../.github/workflows/ci-terraform.yml), [CD](../.github/workflows/cd-dev.yml), [package](../Backend/scripts/package_lambdas.py), [validate run](../scripts/cd/validate_backend_run.py), [dev outputs](../infrastructure/environments/dev/outputs.tf), [prod root](../infrastructure/environments/prod/).

Tham khảo: [Terraform S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3), [GitHub OIDC với AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), [GitHub re-run](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).
