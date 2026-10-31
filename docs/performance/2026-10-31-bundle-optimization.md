# Kết quả tối ưu bundle — 31/10/2026

Mốc trước tối ưu: `aedc72295da8e01ffc8b8ff21414fdd469e12c88`. Sau tối ưu: working tree dựa trên commit này, với các thay đổi lazy-load trong `app/page.tsx`, `admin-editor-dialog.tsx` và `program-reading-page.tsx`. Cùng Node 22.13.0, Next.js 16.3.8, Webpack production, static export và `.env.local`.

## Kết quả

Đơn vị kB = 1.000 byte. Script có trong HTML ban đầu:

| | Trước | Sau | Giảm |
| --- | ---: | ---: | ---: |
| JavaScript chưa nén | 1.192,1 kB | 633,8 kB | 46,8% |
| gzip level 9 | 358,8 kB | 189,0 kB | 47,3% |
| Brotli quality 11 | 303,8 kB | 160,1 kB | 47,3% |

Đã kiểm tra thêm danh sách script thực sự được yêu cầu sau khi đăng nhập bằng Chrome headless, tắt browser cache. Cộng thêm chunk của trang đang mở:

| Trang | gzip trước | gzip sau, gồm chunk tải động của trang | Giảm |
| --- | ---: | ---: | ---: |
| Tổng quan | 358,8 kB | 189,0 kB | 47,3% |
| Giáo án | 358,8 kB | 190,7 kB | 46,9% |
| Chương trình | 358,8 kB | 191,0 kB | 46,8% |
| Giáo lý viên | 358,8 kB | 190,6 kB | 46,9% |
| Tài khoản | 358,8 kB | 192,9 kB | 46,2% |

Các chunk trang sau đăng nhập tương ứng: Giáo án 231, Chương trình 283, Giáo lý viên 813, Tài khoản 824. Tổng quan không yêu cầu thêm chunk trang. Browser xác nhận cả năm trang không yêu cầu file có mã ProseMirror trước khi mở nội dung hoặc editor. Biểu mẫu giáo án tải editor sau thao tác mở.

## Thay đổi

- Dùng `next/dynamic` cho các danh sách, trang đọc, hộp thoại chọn bài và hộp thoại quản trị; giữ props và điều kiện phân quyền hiện có.
- Chỉ mount danh sách thuộc view hiện hành, thay cho render cả các section bị CSS ẩn. Chỉ mount hộp thoại khi mở.
- Trong hộp thoại quản trị, tải riêng editor giáo án/chương trình theo loại biểu mẫu. Khi sửa chương trình từ màn đọc, tải editor lúc chuyển sang chỉnh sửa.
- Giữ TipTap trong màn đọc giáo án/tham khảo để bảo toàn định dạng và DOM cho ghi chú; mã này được tải khi người dùng mở nội dung chi tiết.
- Thêm `Frontend/scripts/measure-export-bundle.mjs` để lấy mốc dung lượng sau mỗi production export. Không thêm thư viện hoặc thay lockfile.

## Kiểm chứng

- Build Webpack production và static export hoàn tất, kèm kiểm tra TypeScript của build.
- 138/138 kiểm thử Node đạt.
- Bộ browser `content-persistence.mjs` đạt: kiểm tra chunk theo trang; tải editor khi mở; toolbar desktop/mobile; định dạng xuống dòng; upload ảnh và khóa lưu trong lúc upload; lưu nháp, giữ dữ liệu khi API lỗi, retry, xuất bản; chương trình thêm buổi/lưu/reload/mở editor/Hủy; tài liệu tham khảo; Reader không có nút quản trị; đăng xuất.
- Bộ browser `personal-profiles.mjs` đạt: cập nhật hồ sơ, neo emoji và highlight, sửa/xóa ghi chú, Back khi có dữ liệu chưa lưu, mobile selection và cách ly ghi chú giữa hai tài khoản.
- Runner browser được sửa để đợi `document.body` tồn tại và đợi biểu mẫu tải động trước thao tác.
- Script đo tái sử dụng cho kết quả trùng với thống kê artifact của build. `git diff --check` đạt.

## Phạm vi số đo

Các số gzip/Brotli là ước lượng nén từng file từ production artifact theo cùng thông số của baseline, chưa phải dung lượng truyền qua CloudFront hoặc thời gian parse/execute. Không bao gồm HTML/RSC, CSS, font, ảnh, API response hoặc chunk editor tải sau khi mở bài/biểu mẫu.

Browser dùng backend giả và token tổng hợp, chặn request ngoài; không kiểm chứng AWS thật hay cold start Lambda. Trong content harness, các trang Giáo lý viên/Tài khoản được kiểm tra việc tải module và hiển thị trạng thái khi Users API không khả dụng; đây không phải nghiệm thu CRUD tài khoản với backend thật. Request analytics `/_vercel/insights/script.js` bị chặn và không thuộc artifact Next được cộng trong bảng.

Không suy ra tốc độ mở editor lần đầu giảm: dung lượng của editor được chuyển sang thời điểm người dùng yêu cầu. Mã khôi phục Cognito vẫn thuộc đường tải ban đầu.

Dữ liệu byte chính xác: [trước](2026-10-31-bundle-baseline.json), [sau](2026-10-31-bundle-after.json). Các báo cáo này là artifact local trong thư mục đang bị `.gitignore` bỏ qua; script đo tái sử dụng và thay đổi runtime nằm trong diff của repository.
