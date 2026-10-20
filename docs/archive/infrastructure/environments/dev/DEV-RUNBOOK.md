> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: infrastructure/environments/dev/DEV-RUNBOOK.md. Ngu?n hi?n h?nh: [CONTEXT](../../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# Runbook môi trường Dev: destroy và dựng lại

Runbook này hướng dẫn xóa toàn bộ stack Dev rồi tạo lại từ đầu trên Windows PowerShell. Không chạy `terraform destroy` nếu chỉ cần build/deploy lại Frontend; trường hợp đó bỏ qua phần 1–2 và làm phần 3.2.

## Tài nguyên và dữ liệu bị ảnh hưởng

Destroy sẽ xóa Cognito User Pool (bao gồm user và group), DynamoDB `giaoan-dev`, hai API/Lambda, CloudFront, app S3 bucket, SNS alarm và budget Dev. Dữ liệu bài học, tài khoản ứng dụng, hồ sơ và ảnh trong môi trường Dev sẽ mất. S3 bật versioning nên phải xóa cả object versions và delete markers trước khi bucket có thể bị xóa.

Terraform state được lưu riêng ở bucket `gxthaian-giaoan-web-2026`, key `giaoan-web/dev/terraform.tfstate`. Destroy stack Dev không được xóa bucket state, key state hoặc thư mục `infrastructure/bootstrap`.

Nếu cần giữ dữ liệu, hãy tạo DynamoDB backup và sao lưu media trước. Cognito user không nằm trong DynamoDB backup và phải được tạo lại sau này.

## 1. Xác nhận AWS profile và stack

Mở PowerShell tại repo root:

```powershell
Set-Location E:\FCAJ\giaoan-web

# Nếu shell có credential AWS cũ, bỏ chúng để Terraform dùng named profile.
Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY, Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
$env:AWS_PROFILE = "giaoan-dev"
$env:AWS_DEFAULT_PROFILE = "giaoan-dev"
$env:AWS_REGION = "ap-southeast-1"
$env:AWS_DEFAULT_REGION = "ap-southeast-1"

aws sts get-caller-identity --profile giaoan-dev
```

Xác nhận `Account` là AWS account Dev dự kiến. Nếu dùng AWS SSO và lệnh STS báo phiên hết hạn, chạy `aws sso login --profile giaoan-dev` rồi xác minh lại.

## 2. Xóa stack Dev

Chuyển vào root Terraform Dev và xác nhận tên tài nguyên hiện tại:

```powershell
Set-Location E:\FCAJ\giaoan-web\infrastructure\environments\dev
terraform init -reconfigure
terraform output
terraform state list
```

### 2.1 Sao lưu nếu cần

Tùy chọn, tạo DynamoDB on-demand backup trước khi xóa:

```powershell
$backupName = "giaoan-dev-before-destroy-$(Get-Date -Format yyyyMMdd-HHmmss)"
aws dynamodb create-backup --table-name giaoan-dev --backup-name $backupName --profile giaoan-dev
```

Nếu cần giữ ảnh hoặc frontend đang có trong S3, sao lưu chúng trước khi làm trống bucket. Backup DynamoDB không lưu Cognito users hay S3 objects.

### 2.2 Làm trống app bucket có versioning

Lấy đúng bucket do Terraform quản lý:

```powershell
$bucket = terraform output -raw app_bucket_name
$bucket
```

Trong AWS Console mở **S3 → bucket có tên trên → Empty**. Xác nhận xóa vĩnh viễn tất cả object versions và delete markers. Thao tác này không thể hoàn tác. Không làm trống bucket state `gxthaian-giaoan-web-2026`.

### 2.3 Lập và xem destroy plan

```powershell
terraform plan -destroy -out=dev-destroy.tfplan
terraform show dev-destroy.tfplan
```

Đọc toàn bộ plan, xác nhận chỉ có tài nguyên của Dev và không có bucket state/bootstrap. Nếu có tài nguyên ngoài stack Dev, dừng lại và kiểm tra backend/state trước khi tiếp tục.

```powershell
terraform apply dev-destroy.tfplan
```

Nếu destroy lỗi do S3 bucket vẫn còn object versions/delete markers, làm trống app bucket như mục 2.2, tạo lại destroy plan rồi apply. Giữ nguyên remote state backend để Terraform có thể quản lý lần dựng tiếp theo.

## 3. Dựng lại backend và Frontend

### 3.1 Tạo hạ tầng Dev

Từ repo root, đóng gói lại Lambda artifacts:

```powershell
Set-Location E:\FCAJ\giaoan-web
.\.venv\Scripts\python.exe Backend\scripts\package_lambdas.py
```

Kiểm tra `infrastructure\environments\dev\terraform.tfvars` vẫn có cấu hình mong muốn. File này chứa cấu hình local, không bị destroy; không ghi AWS keys hoặc passwords vào đó. Với thử nghiệm local, `allowed_origins` cần có `http://localhost:3000`.

```powershell
Set-Location E:\FCAJ\giaoan-web\infrastructure\environments\dev
terraform init -reconfigure
terraform validate
terraform plan -out=dev.tfplan
terraform show dev.tfplan
terraform apply dev.tfplan
```

Chỉ apply sau khi xác nhận account, region, tên tài nguyên, email cảnh báo và chi phí trong plan.

### 3.2 Lấy outputs và cấu hình Frontend

Sau apply, lấy output names (đây là tên output, không phải giá trị bucket):

```powershell
terraform output
terraform output -raw user_pool_id
terraform output -raw app_client_id
terraform output -raw content_api_endpoint
terraform output -raw users_api_endpoint
terraform output -raw table_name
terraform output -raw app_bucket_name
terraform output -raw cloudfront_distribution_id
terraform output -raw frontend_url
```

Cập nhật `Frontend\.env.local` bằng các giá trị mới:

```dotenv
NEXT_PUBLIC_AWS_REGION=ap-southeast-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<user_pool_id>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<app_client_id>
NEXT_PUBLIC_CONTENT_API_URL=<content_api_endpoint>
NEXT_PUBLIC_USERS_API_URL=<users_api_endpoint>
```

Destroy rồi tạo lại sẽ tạo Cognito pool mới và có thể tạo endpoint/distribution mới. Vì vậy phải cập nhật `.env.local` và build lại; không dùng `out` cũ. Các giá trị `NEXT_PUBLIC_*` được nhúng vào JavaScript khi build, nên không đặt secret trong đó.

### 3.3 Tạo lại admin đầu tiên

Lấy Account ID từ profile rồi chạy script tại repo root. Thay `admin@example.com` bằng email admin muốn dùng:

```powershell
Set-Location E:\FCAJ\giaoan-web
$devDir = "E:\FCAJ\giaoan-web\infrastructure\environments\dev"
$poolId = terraform -chdir="$devDir" output -raw user_pool_id
$tableName = terraform -chdir="$devDir" output -raw table_name
$accountId = aws sts get-caller-identity --profile giaoan-dev --query Account --output text

.\.venv\Scripts\python.exe Backend\scripts\create_admin.py `
  --pool-id $poolId `
  --table-name $tableName `
  --email "admin@example.com" `
  --expected-account-id $accountId `
  --profile giaoan-dev
```

Nhập mật khẩu khi được hỏi; Cognito yêu cầu ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số. Không truyền mật khẩu trên command line. Chỉ chạy lại script sau khi đã kiểm tra Cognito và DynamoDB nếu lần chạy trước báo lỗi.

### 3.4 Build và deploy static Frontend

`Frontend/next.config.mjs` cần có `output: 'export'`. Từ repo root:

```powershell
$devDir = "E:\FCAJ\giaoan-web\infrastructure\environments\dev"
$bucket = terraform -chdir="$devDir" output -raw app_bucket_name
$distributionId = terraform -chdir="$devDir" output -raw cloudfront_distribution_id
$frontendUrl = terraform -chdir="$devDir" output -raw frontend_url

Set-Location E:\FCAJ\giaoan-web\Frontend
npm run build
Test-Path .\out\index.html
```

Chỉ tiếp tục nếu `Test-Path` in `True`:

```powershell
aws s3 sync .\out\ "s3://$bucket/frontend/" --profile giaoan-dev
$invalidationId = aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*" --profile giaoan-dev --query Invalidation.Id --output text
aws cloudfront wait invalidation-completed --distribution-id $distributionId --id $invalidationId --profile giaoan-dev
$frontendUrl
```

Mở URL được in ra sau khi CloudFront invalidation hoàn tất. Không cần chạy Terraform apply chỉ vì sửa `next.config.mjs` hoặc `.env.local`.

## 4. Kiểm tra sau khi dựng lại

- Đăng nhập bằng admin mới tạo.
- Kiểm tra API nhận access token và xác minh role; kiểm tra CORS nếu truy cập từ `localhost:3000`.
- Kiểm tra các thao tác API trước khi nhập dữ liệu thật. Nền Cognito/API client đã có, nhưng không mặc định rằng mọi màn hình CRUD của Frontend đã được chuyển khỏi mock data.
- Xác nhận email subscription SNS nếu đã cấu hình `notification_email`; xác nhận cảnh báo budget nếu đã cấu hình `budget_email`.

## Tham chiếu nhanh

Các Terraform outputs được khai báo trong `outputs.tf`; biến môi trường Frontend theo `Frontend/.env.example`; quy trình backend và kiểm tra API nằm trong `Backend/docs/deployment-runbook.md`.
