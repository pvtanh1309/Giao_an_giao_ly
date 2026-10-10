# Frontend Integration Foundation Design

**Date:** 2026-10-10  
**Scope:** Chặng 1 của quá trình tích hợp frontend với backend AWS  
**Status:** Approved in conversation; awaiting written-spec review

## 1. Mục tiêu

Thay cơ chế đăng nhập và phân quyền giả lập của frontend bằng Cognito thật, đồng thời tạo lớp cấu hình và HTTP client dùng chung cho các chặng tích hợp dữ liệu tiếp theo.

Sau chặng này:

- người dùng đăng nhập bằng email và mật khẩu qua Cognito User Pool đã được Terraform tạo;
- phiên đăng nhập được duy trì giữa các tab và sau khi mở lại trình duyệt trên máy cá nhân;
- frontend lấy vai trò từ claim `cognito:groups`, không nhận vai trò do người dùng tự chọn;
- mọi request đến backend có thể lấy access token hợp lệ và gửi `Authorization: Bearer <access-token>`;
- lỗi API có một kiểu dữ liệu và cách xử lý thống nhất;
- dữ liệu nghiệp vụ vẫn là mock/in-memory cho đến các chặng tích hợp nội dung và người dùng.

## 2. Phạm vi

### Bao gồm

- Thêm dependency `amazon-cognito-identity-js`.
- Đọc và kiểm tra cấu hình public của Cognito và hai API theo môi trường.
- Kết nối đến Cognito User Pool và App Client hiện có.
- Đăng nhập, khôi phục phiên, tự refresh session, logout.
- Lưu session Cognito trong `localStorage`.
- Đọc `sub` và group từ access token, đồng thời đọc email từ ID token mà SDK nhận từ Cognito.
- Ánh xạ Cognito group sang vai trò `reader`, `editor` hoặc `admin`.
- Cung cấp trạng thái xác thực qua React context.
- Tạo HTTP client dùng chung và các client biên cho content API và users API.
- Gắn access token vào request và chuẩn hóa response/error envelope.
- Thay logic role giả và `sessionStorage` trong giao diện bằng auth context.
- Thêm kiểm thử cho cấu hình, ánh xạ role, auth state và API client.

### Chưa bao gồm

- Thay dữ liệu giáo án, chương trình, tài liệu tham khảo, giáo lý viên hoặc tài khoản bằng API thật.
- Upload ảnh thật lên S3.
- Quên mật khẩu, đổi mật khẩu chủ động, MFA hoặc đăng nhập liên kết.
- Proxy API qua Next.js server, cookie HttpOnly hoặc thay đổi kiến trúc static hosting.
- Triển khai AWS hay thay đổi Terraform.

## 3. Ranh giới trách nhiệm

Terraform tiếp tục là nơi tạo và cấu hình:

- Cognito User Pool;
- public App Client không có client secret;
- các group `reader`, `editor`, `admin`;
- API Gateway JWT authorizers;
- Lambda và các tài nguyên backend.

Frontend không tạo tài nguyên Cognito. Frontend chỉ tạo đối tượng JavaScript của SDK với `UserPoolId` và `ClientId` để gọi User Pool đã tồn tại.

## 4. Kiến trúc frontend

### 4.1 Cấu hình môi trường

`Frontend/lib/config.ts` đọc các biến:

- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `NEXT_PUBLIC_CONTENT_API_URL`
- `NEXT_PUBLIC_USERS_API_URL`

Module trả về một cấu hình đã chuẩn hóa: URL không có dấu `/` cuối và tất cả giá trị bắt buộc đều khác rỗng. Cấu hình thiếu hoặc sai phải tạo lỗi rõ ràng cho người vận hành, không âm thầm dùng endpoint giả.

Repo cung cấp `Frontend/.env.example` chỉ chứa placeholder, không chứa ID môi trường thật, token, mật khẩu hay secret.

### 4.2 Biên Cognito

`Frontend/lib/auth/cognito.ts` chịu trách nhiệm duy nhất cho giao tiếp với `amazon-cognito-identity-js`:

- tạo `CognitoUserPool` cục bộ trỏ đến pool/client đã có;
- `signIn(email, password)`;
- `completeNewPassword(newPassword)` cho challenge `NEW_PASSWORD_REQUIRED` của user do admin tạo;
- `getSession()` để khôi phục hoặc refresh session;
- `signOut()`;
- trả access token và thông tin user đã chuẩn hóa.

SDK dùng storage tương thích `localStorage`. Session được chia sẻ giữa các tab cùng origin và được giữ khi trình duyệt mở lại. Không lưu mật khẩu. Form xóa password khỏi React state sau mỗi lần submit, dù đăng nhập thành công hay thất bại.

### 4.3 Nhận dạng và vai trò

Kiểu user của ứng dụng gồm:

```ts
type AppRole = 'reader' | 'editor' | 'admin'

type AuthenticatedUser = {
  sub: string
  email: string
  role: AppRole
}
```

`sub` và vai trò được lấy từ access token; email được lấy từ ID token. Vai trò dùng claim `cognito:groups`. Nếu một user thuộc nhiều group, quyền cao nhất thắng theo thứ tự `admin > editor > reader`. Nếu token không có group hợp lệ, frontend không coi phiên là phiên được phép sử dụng ứng dụng và hiển thị lỗi quyền truy cập.

Đây chỉ là điều khiển trải nghiệm giao diện. API Gateway và Lambda vẫn là nguồn quyết định quyền cuối cùng.

### 4.4 Auth Provider

`Frontend/components/auth-provider.tsx` quản lý state machine:

```text
loading -> anonymous
loading -> authenticated
anonymous -> authenticating -> authenticated
anonymous -> authenticating -> new-password-required -> authenticated
anonymous -> authenticating -> anonymous (error)
authenticated -> anonymous (logout/session invalid)
```

Context cung cấp:

- `status`: `loading | anonymous | authenticating | new-password-required | authenticated`;
- `user`;
- `error` dành cho lỗi đăng nhập hoặc khôi phục phiên;
- `login(email, password)`;
- `completeNewPassword(newPassword)`;
- `logout()`;
- `getAccessToken()`.

Provider khôi phục session một lần khi ứng dụng khởi động. Giao diện không render nội dung có quyền trong lúc trạng thái còn `loading`.

### 4.5 API client

`Frontend/lib/api/client.ts` là lớp HTTP dùng chung. Nó:

- nhận base URL và hàm `getAccessToken` qua dependency injection;
- nhận callback `onUnauthorized` để auth provider kết thúc phiên khi backend trả `401`;
- tự thêm `Authorization` và `Content-Type` thích hợp;
- chỉ stringify body khi body tồn tại;
- parse envelope `{ data, meta }` và `{ error, meta }`;
- bảo toàn `requestId` để hỗ trợ vận hành;
- phân biệt lỗi mạng, response không hợp lệ và lỗi do backend trả;
- hỗ trợ request không có body và response `204` nếu backend bổ sung sau này.

`Frontend/lib/api/errors.ts` định nghĩa `ApiError` gồm tối thiểu:

```ts
type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'INTERNAL_ERROR'
  | string
```

`Frontend/lib/api/content.ts` và `Frontend/lib/api/users.ts` tạo biên riêng cho hai base URL. Ở chặng 1, chúng có thể chỉ expose primitive `request`; các hàm nghiệp vụ cụ thể được thêm khi nối từng miền dữ liệu để tránh định nghĩa sớm DTO chưa dùng.

## 5. Luồng dữ liệu

### Đăng nhập

1. Người dùng nhập email và mật khẩu.
2. Auth provider gọi biên Cognito.
3. SDK gửi thông tin xác thực trực tiếp đến Cognito.
4. Cognito xác thực và trả access, ID và refresh token.
5. SDK lưu session trong `localStorage`.
6. Frontend đọc claim từ token, xác định user và role.
7. Mật khẩu bị xóa khỏi state form.

### Gọi API

1. Màn hình hoặc service gọi content/users client.
2. Client gọi `getAccessToken()`.
3. SDK trả session còn hạn hoặc dùng refresh token để gia hạn.
4. Client gửi access token đến API Gateway.
5. API Gateway xác minh chữ ký, issuer, audience và scope.
6. Lambda tiếp tục kiểm tra group và record ACCOUNT hiện hành.
7. Client trả `data` hoặc ném `ApiError` đã chuẩn hóa.

### Phiên không còn hợp lệ

- Nếu không thể khôi phục hoặc refresh session, auth provider xóa session cục bộ và chuyển sang `anonymous`.
- Nếu API trả `401`, API client gọi callback `onUnauthorized`; auth provider logout và giao diện trở về màn hình đăng nhập.
- `403` không logout vì token có thể hợp lệ nhưng user thiếu quyền.
- `409` được giữ nguyên để màn hình nghiệp vụ sau này yêu cầu tải lại dữ liệu.

## 6. Tích hợp vào giao diện hiện tại

Root layout bọc ứng dụng bằng `AuthProvider`. `app/page.tsx` dùng context thay cho:

- `sessionStorage.getItem('giao-ly-user')`;
- state role do frontend tự đặt;
- logic đăng nhập giả hiện tại.

Form đăng nhập hiện có được giữ về mặt bố cục, nhưng submit gọi `login`. Header dùng `logout`. Điều kiện hiển thị theo role tiếp tục dùng `user.role`, để giảm thay đổi giao diện trong chặng 1.

Dữ liệu mẫu vẫn được load như hiện nay. Đây là trạng thái chuyển tiếp có chủ đích: chặng 1 chứng minh xác thực và nền API client độc lập trước khi thay từng nguồn dữ liệu.

## 7. Xử lý lỗi và trải nghiệm

- Cấu hình thiếu: hiển thị thông báo hệ thống chưa được cấu hình và không cho submit đăng nhập.
- Sai email/mật khẩu: thông báo chung, không tiết lộ tài khoản có tồn tại hay không.
- Tài khoản cần đổi mật khẩu do admin tạo: hiển thị form đặt mật khẩu mới khi Cognito trả challenge `NEW_PASSWORD_REQUIRED`.
- Mất mạng: giữ người dùng tại màn hình hiện tại và cho phép thử lại.
- Không có group hợp lệ: logout local và thông báo tài khoản chưa được cấp quyền.
- Session hết hạn và refresh thất bại: trở về đăng nhập với thông báo phiên đã hết hạn.
- `requestId` từ backend được giữ trong đối tượng lỗi; giao diện có thể hiển thị trong phần chi tiết hỗ trợ.

## 8. Kiểm thử

Kiểm thử dùng Node test runner đang có trong frontend, ưu tiên các module thuần và dependency injection để không gọi AWS thật.

Các nhóm kiểm thử bắt buộc:

- cấu hình đầy đủ, thiếu biến, URL có dấu `/` cuối;
- ánh xạ một group, nhiều group và không có group hợp lệ;
- đăng nhập thành công, sai credentials, `NEW_PASSWORD_REQUIRED`, logout;
- khôi phục session thành công và refresh thất bại;
- API client gắn access token đúng;
- parse success/error envelope và giữ `requestId`;
- phân loại lỗi mạng, `401`, `403`, `409` và response không hợp lệ;
- auth provider không hiển thị app trước khi hoàn tất khôi phục session;
- password được xóa khỏi state sau submit.

Không dùng Cognito hay API thật trong test chặng 1. Kiểm thử chấp nhận trên AWS dev thuộc chặng hoàn thiện sau khi frontend đã nối dữ liệu.

## 9. Tiêu chí hoàn tất chặng 1

- Không còn cách chọn hoặc lưu role giả trong frontend.
- Người dùng có thể đăng nhập và đăng xuất bằng Cognito thật khi cung cấp cấu hình dev.
- Mở tab mới cùng origin nhận được phiên đã đăng nhập.
- Tải lại trang hoặc mở lại trình duyệt khôi phục phiên khi refresh token còn hiệu lực.
- Role trên giao diện đến từ `cognito:groups`.
- API client lấy access token hợp lệ và tạo request đúng contract.
- Lỗi auth/API được chuẩn hóa và không log password hoặc token.
- Test mới và test frontend hiện có chạy đạt yêu cầu.
- `npm run build` hoàn tất với TypeScript checking được bật; cấu hình `ignoreBuildErrors` hiện tại phải được loại bỏ để lỗi tích hợp không bị bỏ qua.

## 10. Các chặng tiếp theo

Sau khi chặng 1 hoàn tất:

1. Nối giáo án, chương trình, tài liệu tham khảo và media vào content API.
2. Nối danh bạ giáo lý viên và quản lý tài khoản vào users API.
3. Kiểm thử end-to-end trên AWS dev, triển khai frontend và chuẩn bị promote production.
