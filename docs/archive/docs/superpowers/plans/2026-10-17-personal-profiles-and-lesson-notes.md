> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: docs/superpowers/plans/2026-10-17-personal-profiles-and-lesson-notes.md. Ngu?n hi?n h?nh: [CONTEXT](../../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# Personal Profiles and Private Lesson Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Người dùng đã chọn cách triển khai Native trong cuộc trò chuyện; không giao các chặng triển khai cho subagent.

**Goal:** Mỗi giáo lý viên có tài khoản Reader riêng, tự sửa thông tin liên hệ và ghi chú riêng trên đoạn chữ trong giáo án đã xuất bản.

**Architecture:** Mở rộng Users API cho hồ sơ cá nhân và liên kết Reader; Content API quản lý ghi chú theo sub từ JWT. Dùng bảng DynamoDB hiện tại, tách bản ghi ghi chú khỏi revision giáo án. Frontend thêm menu tài khoản và decorations ở chế độ đọc; không lưu mark ghi chú vào nội dung chung.

**Tech Stack:** Next.js/React/TypeScript, TipTap 3.31.4, amazon-cognito-identity-js, Python Lambda, DynamoDB transactions, Terraform HTTP API.

**Spec:** `docs/superpowers/specs/2026-10-17-personal-profiles-and-lesson-notes-design.md` — đã được người dùng duyệt.

## Global Constraints

- Email cập nhật là email liên hệ; email đăng nhập Cognito và sub không đổi.
- Mỗi hồ sơ chỉ liên kết một ACCOUNT chưa bị xóa; tài khoản DISABLED vẫn giữ quyền liên kết.
- Mọi API riêng dựng khóa từ principal.sub; không nhận owner ID từ request.
- Ghi chú tối đa 8000 ký tự, trích đoạn 2000 ký tự, ngữ cảnh mỗi phía 120 ký tự; tối đa 100 ghi chú/tài khoản/bài.
- Neo dùng Unicode code point; không dùng pixel hoặc DOM index toàn trang.
- Chỉ tạo ghi chú trên PUBLISHED; ghi chú không thay đổi version/content giáo án.
- Không thêm dịch vụ AWS, không thay thế User Pool hoặc bảng DynamoDB, không tự gán tài khoản cũ theo tên/email.
- Đọc Next.js local docs trước khi sửa các component Next; giữ những thay đổi khác của người dùng.
- Chưa chạy hoặc thêm test ở bước lập kế hoạch. Các bước kiểm chứng dưới đây thuộc phạm vi kế hoạch để người dùng duyệt trước khi thực hiện.
- Không push hoặc deploy trong quá trình triển khai local. Việc commit/merge làm theo yêu cầu riêng của người dùng.

## Review Focus

1. Hai Admin gán cùng hồ sơ hoặc restore một tài khoản cũ: không tạo hai liên kết cá nhân còn hiệu lực (Task 1).
2. Đổi người đăng nhập khi request cũ chưa trả về: không đưa hồ sơ/ghi chú người cũ lên màn hình người mới (Tasks 2, 5).
3. Emoji, chữ có dấu, xuống dòng trong ô bảng và các đoạn trùng chữ: không gắn ghi chú sai vị trí (Tasks 3, 5).
4. Request ghi chú trùng do retry hoặc hai tab cùng tạo ghi chú thứ 100: không nhân bản ghi chú hoặc vượt quota (Task 4).
5. ACCOUNT purge bị gián đoạn giữa chừng: retry dọn ghi chú an toàn, không dọn khi tài khoản đã được khôi phục (Task 6).

## Trình tự và điểm bàn giao

1. Backend liên kết tài khoản và hồ sơ cá nhân.
2. Frontend menu tài khoản, cập nhật hồ sơ và cấp Reader cá nhân.
3. Chuẩn hóa neo đoạn chữ giữa Python và TypeScript.
4. Backend ghi chú riêng, quota và concurrency.
5. Frontend chọn chữ, tô dấu riêng và quản lý ghi chú.
6. Dọn dữ liệu khi tài khoản purge, nghiệm thu tích hợp và hướng dẫn triển khai.

Tasks 1–2 tạo ra chức năng hồ sơ cá nhân hoàn chỉnh. Tasks 3–5 tạo chức năng ghi chú hoàn chỉnh. Task 6 hoàn tất vòng đời dữ liệu và khả năng triển khai. Tiến hành liên tục sau khi kế hoạch được duyệt, báo kết quả từng chặng; không hỏi duyệt lại từng task.

## Task 1: Backend hồ sơ cá nhân và liên kết Reader

**Files:**
- Modify: `Backend/users_api/validators/accounts.py`, `Backend/users_api/services/accounts.py`, `Backend/users_api/repositories/dynamodb.py`.
- Create: `Backend/users_api/services/me.py`, `Backend/users_api/validators/me.py`.
- Modify: `Backend/users_api/routes.py`, `infrastructure/modules/user-api/main.tf`, `Backend/docs/api-contract-v1.md`.
- Verify: `Backend/tests/test_users.py`, `Backend/tests/test_routes.py`; create `Backend/tests/test_self_profile.py`.

**Interfaces:**
- `get_me(request, principal) -> {cognitoSub, loginEmail, displayName, profile: object | null}`; profile có catechistId, name, email, phone, group, accompanyingClass, version.
- `update_profile(request, principal)` nhận đúng `{email, phone, group, accompanyingClass, version}` và trả cùng envelope dữ liệu như `get_me`.
- `GET /me`, `PUT /me/profile` cho reader/editor/admin; giữ kiểm tra ACTIVE hiện có.

- [ ] Viết các ca kiểm chứng: Reader mới bắt buộc catechistId; Reader/Editor tạo và đổi liên kết được; hai tài khoản không cùng giữ một hồ sơ; Reader cũ không liên kết vẫn đăng nhập và GET /me trả profile=null.
- [ ] Viết các ca self-update: chỉ bốn trường được phép; đổi email liên hệ không gọi Cognito hoặc sửa ACCOUNT.email; tên và status hồ sơ giữ nguyên; giả mạo catechistId/sub/role trả 400.
- [ ] Chạy các ca mới trước khi triển khai; xác nhận lỗi là chức năng/route chưa có, không phải lỗi fixture.
- [ ] Mở rộng validator và link service cho READER. Kiểm tra các ACCOUNT_LINK bằng strongly consistent reads, bỏ qua ACCOUNT đã DELETED. Mọi transaction đổi liên kết, archive/restore tài khoản có hồ sơ phải guard/touch version hồ sơ để hai thao tác không vượt qua kiểm tra đồng thời. Không bỏ qua kiểm tra độc quyền khi old_id == new_id.
- [ ] Restore không được làm sống lại liên kết trùng; trả 409 để Admin xử lý. Cho Admin sửa liên kết của tài khoản DELETED còn trong thời hạn khôi phục, với cùng kiểm tra độc quyền. Tài khoản không có hồ sơ vẫn đọc nội dung và dùng ghi chú theo sub.
- [ ] Implement `/me`: suy ra hồ sơ từ ACCOUNT, không tin ID do client gửi. PUT dùng một transaction gồm check version ACCOUNT đã đọc và put hồ sơ với expected_version; verify ACTIVE/pendingAction/liên kết trước khi dựng transaction. Hồ sơ có liên kết trùng cũ không được tự cập nhật cho đến khi Admin giải quyết.
- [ ] Thêm registry Python, route Terraform và API contract; không thêm quyền Cognito cho thao tác self-update.
- [ ] Chạy: `..\.venv\Scripts\python.exe -m pytest -q tests/test_users.py tests/test_self_profile.py tests/test_routes.py` tại `Backend`; đạt tất cả case mới và các case cũ đã được cập nhật theo chính sách Reader cá nhân.

## Task 2: Menu tài khoản và giao diện hồ sơ

**Files:**
- Create: `Frontend/lib/api/personal-profile.ts`, `Frontend/components/personal-profile-provider.tsx`, `Frontend/components/account-menu.tsx`, `Frontend/components/personal-profile-dialog.tsx`, `Frontend/app/styles/personal-profile.css`.
- Modify: `Frontend/app/providers.tsx`, `Frontend/components/site-header.tsx`, `Frontend/app/page.tsx`, `Frontend/app/globals.css`.
- Modify: `Frontend/components/system-account-directory.tsx`, `Frontend/lib/api/account-management.ts`.
- Verify: create `Frontend/tests/personal-profile.test.mjs`; update `Frontend/tests/account-management.test.mjs`, `Frontend/tests/auth-ui-integration.test.mjs`.

**Interfaces:**
- `createPersonalProfileApi(api: ApiClient)` trả `getMe()` và `updateProfile(fields)`; kiểu dữ liệu khớp Task 1.
- `PersonalProfileProvider` nằm dưới AuthProvider, cung cấp `{me, loading, error, reload, updateProfile}` qua `usePersonalProfile()`.
- `AccountMenu` nhận tên/email, trạng thái tải, callback cập nhật và logout. Có đúng hai action chính trong menu.

- [ ] Kiểm chứng mapping loginEmail/email liên hệ độc lập; các request lưu có version; form lỗi giữ dữ liệu; request cũ sau logout/đổi sub không được set state.
- [ ] Thêm provider; gắn cache với sub, clear dữ liệu khi đổi sub/anonymous; hủy bỏ kết quả request cũ bằng generation guard. Không ghi hồ sơ vào Cognito claims hoặc localStorage.
- [ ] Thay nút đăng xuất đơn lẻ trên header bằng menu tên người dùng; dùng chữ cái đại diện, Escape/outside click và focus restoration. Fallback email khi profile=null, vẫn logout được nếu GET /me lỗi.
- [ ] Form gồm email liên hệ, phone, hai lớp; hiển thị email đăng nhập chỉ đọc. Nếu chưa có/đã mất liên kết thì hiển thị hướng dẫn liên hệ Admin và không gửi PUT.
- [ ] Sau lưu, cập nhật provider và mục catechist có cùng ID trong danh bạ đang mở; dùng reload riêng cho xung đột, không đóng form khi lỗi.
- [ ] Mở rộng account-management và dialog Admin: cả Reader/Editor yêu cầu hồ sơ khi tạo; bỏ chữ “tài khoản dùng chung”; cho Reader cũ chọn/đổi hồ sơ. Backend vẫn là nơi quyết định độc quyền; UI chỉ hỗ trợ lựa chọn.
- [ ] Chạy: `node --experimental-strip-types --test tests/personal-profile.test.mjs tests/account-management.test.mjs tests/auth-ui-integration.test.mjs` tại `Frontend`; sau đó `npm run build`. Không thay hành vi refresh session/logout sẵn có.

## Task 3: Hợp đồng neo đoạn chữ dùng chung

**Files:**
- Create: `Frontend/lib/lesson-note-anchors.ts`, `Backend/content_api/services/note_anchors.py`.
- Create: `Backend/tests/fixtures/lesson_note_anchors.json`, `Backend/tests/test_note_anchors.py`, `Frontend/tests/lesson-note-anchors.test.mjs`.

**Interfaces:**
- Anchor: `{fieldId, start, end, exactQuote, prefix, suffix, sourceHash}`; start/end là Unicode code-point offsets, end exclusive; sourceHash là SHA-256 hex của canonical UTF-8 field text.
- TypeScript: `canonicalLessonFieldText(value: string | JSONContent): string`, `createLessonNoteAnchor(fieldId, text, start, end): Promise<Anchor>`, `resolveLessonNoteAnchor(text, anchor): {start, end} | null`.
- Python: `canonical_field_text(value) -> str`, `validate_anchor(revision, anchor) -> dict`, `resolve_anchor(text, anchor) -> tuple | None`.

- [ ] Tạo fixture chung: tiếng Việt, emoji ngoài BMP, hardBreak, image, nhiều paragraph, bảng/columns lồng nhau, đoạn trùng chữ, field bị xóa và trường hợp hai ngữ cảnh đều giống.
- [ ] Fixture đơn giản bắt buộc: canonical text `A😀\nB` có 4 code point; chọn emoji cho start=1, end=2, exactQuote=`😀`, prefix=`A`, suffix=`\nB`. Cả Python và TypeScript phải cho cùng kết quả, không dùng chỉ số UTF-16 của JS làm start/end.
- [ ] Quy tắc canonical: normalize CRLF/CR thành LF; text giữ nguyên ký tự và khoảng trắng, không trim/NFC; hardBreak là LF; image là U+FFFC; inline children nối liền; các block/container children nối bằng LF. Plain scripture dùng quy tắc xuống dòng tương tự.
- [ ] FieldId hỗ trợ `scripture`, `keyPoints`, `sentiment`, `preparation`, `section:<section.key>` và `_legacy` nếu dữ liệu cũ còn có trường đó; không dùng index hiển thị làm ID. Trường không còn được hiển thị thì ghi chú vẫn có trạng thái không neo được.
- [ ] Lần tạo: kiểm tra giới hạn 2000/120 ký tự, start/end hợp lệ, quote không toàn khoảng trắng, hash/text/quote/context đúng PUBLISHED đang đọc. Nếu bài đã đổi nội dung giữa lúc chọn và lưu, trả 409, giữ nội dung ghi chú ở client.
- [ ] Lần hiển thị: hash và vị trí còn đúng thì dùng lại; nếu đổi text chỉ nhận một match quote+context duy nhất. Kết quả 0 hoặc nhiều match trả null, không chọn match đầu tiên.
- [ ] Chạy fixture ở cả Python và Node; phải cho cùng text, code-point offsets, hash và kết quả resolve. Không phụ thuộc browser DOM trong hai module này.

## Task 4: Content API ghi chú riêng

**Files:**
- Create: `Backend/content_api/services/lesson_notes.py`, `Backend/content_api/repositories/lesson_notes.py`, `Backend/content_api/validators/lesson_notes.py`, `Frontend/lib/api/lesson-notes.ts`.
- Modify: `Backend/shared/db.py`, `Backend/shared/http.py`, `Backend/content_api/routes.py`, `infrastructure/modules/content-api/main.tf`, `Backend/docs/api-contract-v1.md`.
- Verify: create `Backend/tests/test_lesson_notes.py`, `Frontend/tests/lesson-notes-api.test.mjs`; update `Backend/tests/test_routes.py`, `Backend/tests/test_repository_integration.py`.

**Interfaces:**
- `LessonNote`: `{noteId, lessonId, anchor, body, version, createdAt, updatedAt}`. Không trả khóa PK/SK, không cho sửa anchor qua PUT.
- GET `/me/lessons/{lessonId}/notes` trả `{data: LessonNote[]}`.
- POST nhận `{noteId, anchor, body}`; noteId do client tạo bằng UUID và giữ nguyên khi retry, giúp tạo idempotent.
- PUT nhận `{body, version}`; DELETE nhận `{version}`; trả note đã lưu hoặc `{noteId}` khi xóa.
- `Store.query_prefix(pk: str, sk_prefix: str)` là strongly consistent query, không scan.

- [ ] Kiểm chứng A/B cùng lesson, Admin dùng noteId của A, giả mạo sub trong body, disabled account, draft-only lesson, PUBLISHED bị archive và version conflict. Ghi chú không làm đổi META/DRAFT/PUBLISHED của bài.
- [ ] Khóa ghi chú: `ACCOUNT#<JWT sub>` / `LESSONNOTE#<lessonId>#<noteId>`; quota: cùng PK, SK `LESSONNOTECOUNT#<lessonId>` với count/version. Không có GSI. Query GET theo đúng prefix bài, sắp theo createdAt và noteId.
- [ ] Mỗi thao tác kiểm tra ACCOUNT ACTIVE. GET/POST/PUT yêu cầu bài có PUBLISHED còn được đọc; DELETE chỉ cần bản ghi thuộc tài khoản để chủ xóa được ghi chú còn sót sau khi bài purge. POST kiểm tra neo qua Task 3; transaction check ACCOUNT version và META version, put note nếu chưa có, put quota expected_version hoặc create. Không có update vào item giáo án.
- [ ] POST retry cùng noteId và cùng nội dung trả note đã lưu, không tăng quota; cùng noteId khác nội dung trả 409. Đọc quota consistent, tối đa 100; nếu quota đổi có retry giới hạn ba lần rồi trả 409. Hai request cùng tạo khi count=99 chỉ một note mới được ghi.
- [ ] Body phải là chuỗi không toàn khoảng trắng và tối đa 8000 Unicode code point; giữ nguyên xuống dòng và khoảng trắng người dùng viết. Kiểm tra idempotency trước khi từ chối quota đầy để retry của ghi chú thứ 100 vẫn thành công.
- [ ] PUT/DELETE dùng expected note version; DELETE giảm quota trong transaction, retry đã xóa không giảm lần hai. Sửa body không phụ thuộc đoạn gốc còn resolve được; chỉ yêu cầu bài vẫn được đọc. Không ghi body/quote vào log.
- [ ] Thêm route Python/Terraform, POST 201 trong shared HTTP và route-role tests; giữ `Cache-Control: no-store`.
- [ ] Implement client methods `list(lessonId)`, `create(lessonId, input)`, `update(lessonId, noteId, body, version)`, `remove(lessonId, noteId, version)` dùng Content ApiClient và token hiện có.
- [ ] Chạy các case notes, anchor, routes và repository; xác nhận transaction shapes trên fake low-level DynamoDB client có cùng condition như adapter thật. Chạy frontend API tests với fetch giả, không gọi AWS thật.

## Task 5: Chọn chữ và hiển thị ghi chú cá nhân

**Files:**
- Create: `Frontend/components/lesson-notes-panel.tsx`, `Frontend/components/lesson-note-dialog.tsx`, `Frontend/components/lesson-note-context.tsx`, `Frontend/components/lesson-note-decorations.ts`, `Frontend/lib/lesson-note-selections.ts`, `Frontend/app/styles/lesson-notes.css`.
- Modify: `Frontend/components/lesson-rich-text-editor.tsx`, `Frontend/components/lesson-reading-page.tsx`, `Frontend/lib/api/content-management.ts`, `Frontend/app/page.tsx`, `Frontend/app/globals.css`.
- Verify: create `Frontend/tests/lesson-note-selections.test.mjs`; extend the existing offline browser harness for notes/profile routes and two separate account sessions.

**Interfaces:**
- Personal lesson read mode luôn dùng `GET /lessons/{id}`, ngay cả khi role=editor/admin; thêm lối mở "Xem bản đã xuất bản" và quay lại chế độ quản lý.
- `LessonNoteContext` gắn `{sub, lessonId, readMode}`; cung cấp notes, selection, draft-dialog state và mutation methods qua Task 4.
- `LessonRichTextEditor` nhận optional stable `noteFieldId`; decorations plugin nhận `{noteId, from, to}` theo ProseMirror positions, không serialize vào getJSON().
- Selection adapter chuyển DOM/TipTap positions thành canonical code-point offsets và ngược lại, dùng text model Task 3.

- [ ] Kiểm chứng mapping selection qua emoji, soft break, bảng và columns; chọn xuyên hai field bị từ chối; chọn chỉ whitespace hoặc ảnh không mở form. Selection vẫn giữ khi bấm nút trên điện thoại.
- [ ] Thêm personal-read mode, field IDs cho rich fields/sections và Lời Chúa. Bài chưa publish không bật thao tác ghi chú. Không thay đổi editor đang soạn bản nháp.
- [ ] Theo dõi selection trong phạm vi field; hiện nút "Thêm ghi chú riêng" đủ lớn cho touch, lưu selection trước pointerdown/focus. Người dùng gõ body trong hộp có trích đoạn. Form dùng plaintext, render text React, không inject HTML.
- [ ] Tô dấu bằng decoration; render notes đè nhau bằng tập ID rõ ràng để người dùng chọn đúng note. Với scripture dùng renderer chia text segment tương đương, không ghi mark vào dữ liệu.
- [ ] Thêm panel "Ghi chú của tôi", thao tác xem/sửa/xóa, trạng thái detached "Đoạn gốc đã thay đổi". Chỉ báo thành công sau response; lỗi giữ draft và noteId để retry. Xung đột không tự ghi đè.
- [ ] Guard request theo sub + lessonId + generation; clear state khi logout/đổi tài khoản. Nhắc khi đóng dialog/chuyển trang có draft chưa lưu, beforeunload khi còn thay đổi. Không lưu draft/body vào localStorage.
- [ ] Bố cục desktop cạnh bài hoặc panel mở/đóng; mobile dùng panel/dialog trong viewport, không che thao tác chọn chữ, không đổi bố cục nhiều cột/bảng của giáo án.
- [ ] Offline browser checks dùng hai sub riêng: A tạo/sửa note, B không thấy; reload A còn note; đổi tài khoản lúc GET chậm không lộ note; sửa publication làm anchor detached vẫn đọc được ghi chú. Không bấm lưu hoặc tạo dữ liệu trên AWS thật.

## Task 6: Vòng đời, nghiệm thu và hướng dẫn deploy

**Files:**
- Modify: `Backend/users_api/stream.py`, `Backend/docs/deployment-runbook.md`, `Backend/docs/api-contract-v1.md`, `Backend/tests/test_users.py`, `Backend/tests/test_regressions.py`.
- Modify only if needed: IAM query/delete permissions trong `aws_iam_role_policy.lambda` tại `infrastructure/modules/user-api/main.tf`; hiện đã có Query/DeleteItem trên bảng, nên cleanup dự kiến không cần quyền mới.
- Extend: `Frontend/tests/browser/README.md`; record verification results in the implementation ledger.

- [ ] Thêm cleanup khi ACCOUNT PROFILE bị TTL purge hợp lệ: sau kiểm tra không có ACCOUNT được khôi phục, query prefix `LESSONNOTE#` và `LESSONNOTECOUNT#`; xóa từng item theo batch transaction tối đa 25, có retry qua partial batch failure hiện có. Không cần BatchWriteItem IAM mới.
- [ ] Kiểm chứng cleanup bị gián đoạn rồi retry, Cognito user đã bị xóa, quota còn sót, ACCOUNT khôi phục trước stream xử lý và sự kiện xóa note không bị hiểu nhầm thành xóa ACCOUNT.
- [ ] Giữ lại ghi chú khi account bị disable hoặc archive còn thời gian khôi phục; không xóa theo thay đổi liên kết hồ sơ hoặc email. Xóa note ở bài không còn đọc được có thể là own-delete, không cho đọc nội dung bài đã purge.
- [ ] Chạy full Backend suite, frontend unit tests, TypeScript, production build và offline browser checks sau khi được duyệt phạm vi kiểm chứng trong kế hoạch. Kết quả phải phân biệt local/fake với AWS thực tế.
- [ ] Chạy `terraform fmt -check -recursive infrastructure` và validate cấu hình trong môi trường có provider sẵn; không apply/đổi cloud resources. Đối chiếu danh sách route Python với Terraform.
- [ ] Tài liệu deploy: Backend CI đóng gói hai ZIP → Terraform bổ sung routes và cập nhật Lambda → Frontend build/deploy. Không destroy. Reader cũ do Admin liên kết thủ công với hồ sơ thật trước khi tự sửa thông tin.
- [ ] Review toàn bộ patch theo tiêu chí spec: quyền sở hữu API, IDOR, request stale, Unicode anchors, quota concurrency, profile conflict, cleanup. Sửa lỗi quan trọng trước khi bàn giao; không tự push/deploy.

## Kiểm chứng dự kiến

Các lệnh dưới đây chưa chạy ở bước kế hoạch:

```powershell
# Backend (thư mục Backend)
..\.venv\Scripts\python.exe -m pytest -q

# Frontend (thư mục Frontend)
npm test
npx tsc --noEmit
npm run build
npm run test:content-ui

# Root — định dạng Terraform, không apply
terraform fmt -check -recursive infrastructure
```

Chỉ dùng fixture/local server và fake Cognito/DynamoDB cho kiểm chứng tự động. Đăng nhập/tạo tài khoản, ghi chú hoặc cập nhật hồ sơ trên AWS thật nằm trong bước nghiệm thu riêng có người dùng cho phép.

## Handoff

Kế hoạch chờ người dùng xem và xác nhận. Phương thức thực hiện đã có: Native, triển khai trực tiếp từng chặng trong phiên hiện tại. Chưa triển khai code sản phẩm trong bước lập kế hoạch.
