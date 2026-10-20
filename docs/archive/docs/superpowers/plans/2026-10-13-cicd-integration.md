> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: docs/superpowers/plans/2026-10-13-cicd-integration.md. Ngu?n hi?n h?nh: [CONTEXT](../../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# CI/CD Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Thực hiện native theo từng chặng; chưa triển khai từ tài liệu này.

**Goal:** Kiểm tra mọi PR, phát hành Frontend và hai Lambda lên Dev, sau đó đưa bản đã kiểm tra lên Prod với kế hoạch Terraform được duyệt và khả năng rollback.

**Architecture:** GitHub Actions trên Linux runner → CI → artifact theo commit SHA → AWS qua OIDC → Terraform plan/apply → build Frontend theo môi trường → S3 `frontend/` → CloudFront → smoke checks. Terraform tiếp tục quản lý code Lambda. Bản đầu dùng deploy thủ công qua Actions; chỉ bật tự động Dev sau khi pipeline đã chạy thành công và có bộ kiểm tra giới hạn Terraform plan.

**Tech Stack:** Next.js static export, pnpm theo `packageManager`, Node phiên bản tương thích được chốt ở chặng 1, Python 3.12, pytest/moto, Terraform >=1.15 với phiên bản cụ thể được pin, AWS S3/CloudFront/Lambda, GitHub Actions/OIDC.

**Spec:** Thiết kế đề xuất và các giả định nằm trong tài liệu này. Trạng thái: chờ review; chưa có workflow hoặc AWS role nào được tạo.

## Global Constraints

- Remote hiện tại: `pvtanh1309/Giao_an_giao_ly`; chưa có `.github/workflows/`.
- Giữ nguyên thay đổi đang có ở `Backend/content_api/services/media.py`, `infrastructure/modules/app-hosting/main.tf` và `.agents/`.
- PR chỉ chạy kiểm tra offline; không có AWS credentials, không dùng `pull_request_target` để chạy code PR.
- AWS dùng credential tạm thời qua OIDC. Chỉ job cần AWS được cấp `id-token: write`; mặc định `contents: read`.
- Tách quyền và state Dev/Prod. Không đưa access key, mật khẩu admin, state hay toàn bộ tfvars thật vào Git.
- CI/CD không tạo admin, không chạy destroy, không thay thế kiểm thử nghiệp vụ người dùng.
- Không gọi `aws lambda update-function-code`: Terraform đang sở hữu `filename` và `source_code_hash`.
- Không tự động apply plan có delete/replace hoặc thay đổi hạ tầng ngoài phạm vi được phép.
- Frontend chứa `NEXT_PUBLIC_*` tại build time: build riêng Dev/Prod từ cùng source SHA; không dùng bundle Dev cho Prod.
- Lambda ZIP phải được giữ nguyên từ plan đến apply và promotion, kiểm tra SHA256; không rebuild giữa hai bước.
- Mọi workflow ghi cùng môi trường dùng chung concurrency group `deploy-dev` hoặc `deploy-prod`, `cancel-in-progress: false`. CI PR có thể hủy run cũ.
- Không lưu raw Terraform plan/state trong log hoặc comment PR; plan artifact có thể chứa dữ liệu nhạy cảm, hạn chế truy cập và retention.
- Các Action được pin bằng full commit SHA đã xác minh; quản lý cập nhật bằng Dependabot.

## Review Focus

1. OIDC trust có đúng repository, subject format thực tế, audience và môi trường không?
2. PR/fork có thể truy cập role hoặc chạy apply không?
3. Plan được duyệt có đúng SHA, artifact, tfvars và state mà apply sử dụng không?
4. Frontend có đúng Cognito/API outputs của môi trường đích không?
5. Upload có đụng `lesson-media/`, xóa assets đang được browser sử dụng hoặc làm mất phiên bản rollback không?
6. Terraform có thay đổi tài nguyên ngoài code Lambda khi bật auto Dev không?

## Luồng phát hành

```text
PR → CI bắt buộc → merge main
                    ↓
           build Lambda + manifest
                    ↓
     chọn môi trường → Terraform plan → review/approval
                    ↓
     apply saved plan → đọc outputs → build Frontend
                    ↓
     upload assets trước, HTML sau → invalidate → smoke
                    ↓
          ghi nhận release thành công của môi trường

Prod chỉ chọn source SHA đã có release Dev thành công.
```

Trong bản đầu, người vận hành bấm chạy deploy Dev và review plan. Prod có approval trước apply. Việc review diễn ra sau khi plan và các artifact cần thiết đã được chuẩn bị. Frontend build sau apply để hỗ trợ lần tạo môi trường đầu tiên; lỗi build/deploy lúc này có thể khiến Backend đã cập nhật nhưng Frontend chưa cập nhật. Các thay đổi API phải tương thích ngược và pipeline phải báo rõ trạng thái từng phần.

## Chặng 1 — CI cho mọi PR và main

**Files:** tạo `.github/workflows/ci.yml`, `.github/dependabot.yml`; cập nhật `.gitignore` để chỉ whitelist tài liệu kế hoạch cần version control. Chỉ sửa cấu hình dependency khi baseline chứng minh cần thiết.

**Consumes:** source và lockfiles. **Produces:** kết quả kiểm tra, hai ZIP Lambda, manifest chứa source SHA và checksum. Build Frontend của PR dùng cấu hình giả hợp lệ, không phải artifact deploy.

- [ ] Chốt Node, pnpm và Terraform versions có thật, tương thích với dependencies hiện tại; pin runner `ubuntu-24.04`, Python 3.12. Dùng pnpm theo `Frontend/package.json` và `pnpm-lock.yaml`; xử lý lockfile npm cũ bằng thay đổi riêng được review.
- [ ] Frontend: `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, working directory `Frontend`. Cấp năm biến public giả hợp lệ qua job env; không lấy `.env.local` máy cá nhân.
- [ ] Backend: cài `Backend/requirements-dev.txt`; `python -m pytest -q` tại `Backend`; `python Backend/scripts/package_lambdas.py` tại repo root. Dùng AWS env giả cho moto nếu suite yêu cầu; không gọi AWS thật.
- [ ] Terraform: `terraform fmt -check -recursive infrastructure`; tại cả Dev/Prod chạy `init -backend=false -input=false` rồi `validate`. Có ZIP Lambda trước validate; giữ provider lockfiles, dùng `-lockfile=readonly` sau khi xác nhận lock hỗ trợ Linux.
- [ ] Gộp kết quả vào job ổn định tên `ci-required`; không dùng path filter khiến required check bị bỏ qua. Cấu hình main yêu cầu check này trước merge nếu gói GitHub hỗ trợ.
- [ ] Upload ZIP và release manifest từ source main tin cậy; không cho deployment dùng artifact PR hoặc run khác repository. Cache dependencies theo lockfile, không cache credential/state/plan.
- [ ] Khi thực hiện chặng này, chạy baseline và giải quyết lỗi thật trước khi bật required checks. Không thêm lint command chưa tồn tại vào pipeline.

**Hoàn thành khi:** PR tốt qua; PR cố tình lỗi test/build bị chặn; fork không có AWS quyền; artifact main tra được về đúng SHA.

## Chặng 2 — OIDC và cấu hình môi trường

**Files:** tạo root riêng `infrastructure/cicd/{main,variables,outputs,providers,versions,backend}.tf`, `infrastructure/cicd/terraform.tfvars.example`; tạo `infrastructure/docs/cicd-runbook.md`.

**Consumes:** account ID, repository metadata, backend bucket hiện hữu và cấu hình môi trường. **Produces:** OIDC provider dùng chung và role ARNs cho từng môi trường; hướng dẫn bootstrap bằng operator.

- [ ] Kiểm tra repository public/private, gói GitHub, tính năng environment approval và branch protection. Không giả định private repo có required reviewers. Nếu không có gate cưỡng chế, giữ Prod apply ở bước operator local sau khi review; chưa bật Prod apply trong Actions.
- [ ] Kiểm tra AWS identity và state hiện tại trước bootstrap. Nếu môi trường đã destroy, tạo lại qua luồng hạ tầng thủ công có review trước khi deploy ứng dụng.
- [ ] Dùng state riêng `giaoan-web/cicd/terraform.tfstate` trong bucket backend hiện tại; không đổi key bootstrap/dev/prod. Kiểm tra provider OIDC đã tồn tại: import hoặc tham chiếu, không tạo trùng.
- [ ] Kiểm tra subject format OIDC thực tế. Repo mới có thể dùng owner/repo IDs trong `sub`; không hardcode mẫu legacy khi chưa xác minh. Không ghi toàn bộ token vào log.
- [ ] Tạo role plan và role apply riêng cho Dev/Prod. Plan được đọc tài nguyên, đọc state và quản lý đúng `.tflock`, không được cập nhật hạ tầng. Apply chỉ tài nguyên môi trường đích; giới hạn `iam:PassRole` theo Lambda roles/service, IAM permissions boundary khi cần tạo role; không dùng AdministratorAccess.
- [ ] Role CI/CD không được sửa OIDC provider, trust/policy của chính các role CI/CD hay root `infrastructure/cicd`. Những thay đổi này do operator thực hiện.
- [ ] GitHub Environments: `dev-plan`, `dev`, `prod-plan`, `prod`; chỉ cho ref main. Role trust khớp chính xác environment và `aud=sts.amazonaws.com`; plan environments không cấp apply role. Prod apply environment có required reviewer khi hỗ trợ.
- [ ] Cấu hình GitHub variables theo bảng bên dưới, cấp quyền ngắn hạn bằng `aws-actions/configure-aws-credentials`, kiểm tra expected account ngay sau assume role.
- [ ] Operator review rồi apply root CI/CD một lần bằng profile local. Ghi quy trình thu hồi role và quản lý quyền; không thực hiện apply chỉ vì tài liệu này đã tồn tại.

**Hoàn thành khi:** đúng main/environment assume được role; PR, repository khác và environment khác bị từ chối; Dev không ghi được state/tài nguyên Prod.

### Cấu hình đầu vào

| Nơi | Giá trị | Ghi chú |
|---|---|---|
| GitHub variables từng môi trường | `AWS_REGION`, `AWS_ACCOUNT_ID` | Không phải secret; xác minh với caller identity |
| GitHub variables từng môi trường | `AWS_PLAN_ROLE_ARN` hoặc `AWS_DEPLOY_ROLE_ARN` | Chỉ role phù hợp job |
| Cấu hình Terraform đã review | region, domain, certificate ARN, hosted zone, CORS, retention | Commit cấu hình không nhạy cảm; giá trị nhạy cảm dùng secret/file tạm, không log |
| Terraform backend | bucket/key/lockfile trong repo | Quyền S3 giới hạn theo state key và lock key |
| Terraform outputs | bucket, distribution, Cognito, API URLs | Đọc tự động, không nhập lại resource name thủ công |

## Chặng 3 — Deploy Dev hoàn chỉnh qua Actions

**Files:** tạo `.github/workflows/deploy.yml`, `scripts/cicd/{release_manifest,frontend_env,deploy_frontend,smoke_check}.py`; cập nhật `infrastructure/docs/cicd-runbook.md`.

**Consumes:** main SHA đã qua CI, ZIP + checksums, cấu hình Terraform Dev. **Produces:** saved plan, artifact Frontend Dev và manifest release ghi trạng thái từng bước.

- [ ] `workflow_dispatch` chọn environment Dev và source SHA. Workflow phải chạy từ main; kiểm tra SHA thuộc main và có CI thành công cho chính SHA đó. Checkout source SHA ở mọi job; không lẫn SHA của workflow với SHA ứng dụng.
- [ ] Build/download Lambda artifact đúng run tin cậy. Manifest gồm repository, source SHA, run ID, tool versions và checksum từng ZIP; verify trước plan và apply.
- [ ] Job plan dùng Dev plan role, `terraform init -input=false`, `terraform plan -input=false -lock-timeout=5m -out=release.tfplan`. Upload saved plan với checksum và bản tóm tắt đã lọc. Review drift, create/update/delete/replace trước apply.
- [ ] Job apply được duyệt theo khả năng GitHub; dùng apply role, cùng source, tool version, cấu hình và đường dẫn ZIP. Download và verify saved plan, `terraform apply -input=false release.tfplan`. Nếu plan stale: tạo plan mới và duyệt lại, không tự thay bằng plan khác.
- [ ] Toàn workflow giữ concurrency môi trường từ plan đến smoke. State S3 tiếp tục dùng `use_lockfile=true`; quy trình yêu cầu local operator không deploy song song với pipeline.
- [ ] Đọc `terraform output -json`, validate đủ output và đúng environment. Chuyển sang build env theo bảng mapping; không đưa toàn output JSON vào browser hoặc log.
- [ ] Cài dependencies frozen rồi build Frontend từ source SHA với env Dev. Lưu artifact kèm checksum, environment, Cognito/API public config, source SHA và ZIP checksums.
- [ ] Upload `_next/static/` trước với cache immutable; upload assets khác và HTML sau với cache phù hợp. Chỉ ghi `s3://<app_bucket_name>/frontend/`; không sync bucket root, không xóa `lesson-media/`, không dùng `--delete` trong bản đầu. Giữ assets cũ cho cached HTML.
- [ ] Tạo CloudFront invalidation và đợi hoàn thành với timeout. Không báo deploy thành công chỉ vì upload S3 xong.
- [ ] Smoke: trang chủ và route static thực có trả HTML đúng, manifest/version xác nhận SHA đã deploy; hai API route tồn tại trả 401 khi thiếu token. Chọn route từ code, không coi 403/404 là thành công; GET kiểm tra không ghi dữ liệu.
- [ ] Sau smoke thành công mới ghi release Dev thành công; khi thất bại ghi bước đã thay đổi, hướng dẫn xử lý. Không rollback dữ liệu tự động.

**Hoàn thành khi:** một commit main deploy end-to-end Dev, mở URL CloudFront được, cấu hình auth/API đúng, invalidate hoàn tất, smoke qua và nhận diện được release.

### Mapping build Frontend

| Build env | Nguồn |
|---|---|
| `NEXT_PUBLIC_AWS_REGION` | Region Terraform của môi trường đích |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | output `user_pool_id` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | output `app_client_id` |
| `NEXT_PUBLIC_CONTENT_API_URL` | output `content_api_endpoint` |
| `NEXT_PUBLIC_USERS_API_URL` | output `users_api_endpoint` |

Các giá trị này là public config; không phải AWS access credentials. Build fail nếu thiếu hoặc sai định dạng.

## Chặng 4 — Prod promotion và rollback

**Files:** mở rộng `.github/workflows/deploy.yml`; tạo `.github/workflows/rollback.yml`; mở rộng manifest helpers và runbook.

**Consumes:** release Dev thành công và saved plan Prod. **Produces:** release Prod theo cùng source SHA, Frontend build riêng Prod; quy trình rollback có thể chạy lại.

- [ ] Chỉ nhận SHA có manifest Dev thành công từ run tin cậy và cùng repository. Giữ Lambda ZIP nguyên bản; nếu artifact đã hết hạn thì tạo release mới qua Dev, không âm thầm rebuild rồi gọi là cùng artifact.
- [ ] Tạo Prod plan bằng plan role; tóm tắt tài nguyên thay đổi, ảnh hưởng dữ liệu, source SHA và checksums trước approval. Apply role chỉ dùng sau required review; fallback local nếu gói GitHub không có gate.
- [ ] Apply plan được duyệt, đọc outputs Prod, build lại Frontend đúng Prod, upload/invalidate/smoke như Dev. Không copy `.env.local` hoặc bundle Dev.
- [ ] Giữ ZIP, Frontend môi trường và manifests tối thiểu 30 ngày theo giới hạn gói Actions; raw plans retention ngắn, ví dụ 1 ngày. Runbook nêu rõ rollback window và fallback khi artifact hết hạn.
- [ ] Rollback chọn release thành công trước của cùng environment; verify artifact và config trước thao tác. Tạo Terraform plan từ hạ tầng hiện hành với ZIP cũ, review/apply; không checkout và apply toàn bộ hạ tầng cũ. Restore Frontend artifact cũ chỉ khi Cognito/API config còn phù hợp, rồi invalidate/smoke.
- [ ] Runbook phân biệt rollback code với restore dữ liệu; không restore DynamoDB/Cognito/S3 media tự động. Backend và Frontend deployment chưa atomic; rollback từng phần phải được báo rõ.
- [ ] Diễn tập rollback ở Dev và acceptance đăng nhập, phân quyền, đọc/ghi nội dung bằng người vận hành trước lần Prod đầu tiên. Smoke 401 không chứng minh toàn bộ nghiệp vụ hoạt động.

**Hoàn thành khi:** Prod gate cưỡng chế được, sai SHA bị chặn, release truy vết được và rollback Dev đã được diễn tập.

## Chặng 5 — Bật tự động Dev cho cập nhật ứng dụng

**Files:** tạo `scripts/cicd/check_app_plan.py`; mở rộng workflow và root `infrastructure/cicd`; thêm kiểm tra cho validator khi triển khai.

- [ ] Push main sau CI tự chuẩn bị release Dev. Đọc `terraform show -json` nhưng không log toàn JSON.
- [ ] Validator chỉ cho no-op và update tại đúng hai địa chỉ Lambda, với tập trường thay đổi code được xác minh từ provider thực tế. Chặn create/delete/replace, IAM, Cognito, DynamoDB, bucket, API, unknown values và output thay đổi ngoài allowlist.
- [ ] Dùng role app deploy riêng: read/refresh Terraform, state/lock tương ứng, update code đúng hai Lambda, upload đúng prefix, invalidate đúng distribution. Không có quyền sửa IAM hoặc hạ tầng khác. Bộ kiểm tra plan là lớp bổ sung cho IAM, không thay IAM.
- [ ] Khi plan vượt phạm vi: dừng auto apply và yêu cầu chạy luồng hạ tầng có review ở chặng 3/4. Không tự chuyển sang role rộng hơn.
- [ ] Kiểm tra validator với plan code-only hợp lệ và các trường hợp phá scope. Kiểm tra deployment serialization và commit mới trong lúc release cũ chạy.

**Hoàn thành khi:** merge code ứng dụng cập nhật Dev tự động; thay đổi hạ tầng luôn đi luồng review; Prod vẫn cần duyệt.

## Thứ tự và điểm quyết định

1. Chặng 1 có thể thực hiện ngay sau khi duyệt kế hoạch, không cần AWS.
2. Chặng 2 cần xác minh account/repository và khả năng approval; bootstrap IAM là thao tác AWS riêng.
3. Chặng 3 chạy Dev thủ công đầu tiên để kiểm chứng toàn luồng.
4. Chặng 4 chỉ bật khi Dev ổn định và có gate Prod phù hợp.
5. Chặng 5 tối ưu tự động hóa sau khi đã chứng minh giới hạn plan và IAM.

Chưa thêm E2E tự động có mật khẩu thật, WAF, MFA, migration auth SDK hoặc cấu hình database mới vào phạm vi CI/CD này. Những việc đó cần yêu cầu và kế hoạch riêng.

## Tài liệu chính thức đã đối chiếu

- [GitHub OIDC with AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws): credential tạm thời, audience, subject theo environment và subject có immutable IDs.
- [AWS configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials): cấu hình assume role và expected account.
- [GitHub environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments): deployment restrictions, reviewers và giới hạn public/private theo gói.
- [Terraform S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3): state locking, quyền object state/lock riêng.
- [Terraform saved plans](https://developer.hashicorp.com/terraform/tutorials/cli/plan): apply đúng saved plan sau review.

## Review của bản kế hoạch

- Bám đúng static export `Frontend/out/`, hai ZIP hiện hữu và Terraform outputs hiện hữu.
- Chưa thay đổi source/workflow, chưa chạy test hay deploy AWS khi lập kế hoạch.
- `docs/*` hiện bị gitignore; tài liệu này là artifact local. Chặng 1 sẽ whitelist đúng file cần commit, không mở toàn bộ tài liệu/secret local.
- Cần xác minh thực tế ở chặng 2: AWS state còn tồn tại hay đã destroy, repo visibility/gói GitHub, OIDC subject và provider đã tồn tại.
