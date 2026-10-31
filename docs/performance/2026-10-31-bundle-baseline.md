# Mốc đo bundle production — 31/10/2026

Source: commit `aedc72295da8e01ffc8b8ff21414fdd469e12c88`, tracked worktree sạch trước đo. Node 22.13.0, Next.js 16.3.8, Webpack, `output: 'export'`, dependencies đang cài và `.env.local` hiện có. Đây là build local; cấu hình public env của release khác có thể làm kết quả khác.

## Kết quả tải JavaScript ban đầu

Đơn vị kB = 1.000 byte. Cộng các script riêng biệt được HTML export khai báo cho trình duyệt hiện đại, với cache trình duyệt rỗng.

| Trang | File JS | Chưa nén (kB) | gzip (kB) | Brotli (kB) |
| --- | ---: | ---: | ---: | ---: |
| `/` | 12 | 1.192,1 | 358,8 | 303,8 |
| `/dashboard` | 12 | 1.192,1 | 358,8 | 303,8 |
| `/lesson-plans` | 12 | 1.192,1 | 358,8 | 303,8 |
| `/programs` | 12 | 1.192,1 | 358,8 | 303,8 |
| `/catechists` | 12 | 1.192,1 | 358,8 | 303,8 |
| `/accounts` | 12 | 1.192,1 | 358,8 | 303,8 |

Các trang dùng 11 file JS chung; file thứ 12 là wrapper route rất nhỏ. Điều này xác nhận các trang danh bạ/tổng quan cũng kéo theo mã editor. HTML chờ khôi phục session đã tham chiếu các chunk này, nên việc chưa mở editor hoặc chưa xác nhận role không trì hoãn việc tải chúng.

## Các nhóm cần ưu tiên

| Nhóm chunk tải ban đầu | Chưa nén (kB) | gzip (kB) | Brotli (kB) | Bằng chứng |
| --- | ---: | ---: | ---: | --- |
| `837` + `011222a6` + `35ae2ebf` | 483,0 | 155,0 | 132,7 | TipTap core, ProseMirror view và nhóm phụ thuộc editor; chunk 837 còn chứa một số mã Next, icon và thư viện khác |
| `287` | 159,2 | 40,5 | 33,8 | `app/page.tsx` cùng 55 module ứng dụng, gồm danh bạ, quản trị tài khoản, màn đọc và editor |
| `317` | 84,9 | 24,4 | 21,4 | Cognito SDK, buffer và các tiện ích crypto/AWS |
| `210` + `21ed800a` | 442,5 | 129,9 | 107,9 | Runtime/framework Next |

Ba chunk chứa editor chiếm khoảng **43,2% tổng gzip ban đầu**. Đây là dung lượng của các chunk ứng viên để tách; không phải cam kết sẽ giảm được toàn bộ 155 kB vì có mã dùng chung và kết quả chunking sẽ đổi khi tối ưu.

Một số module ứng dụng lớn trong chunk 287, theo kích thước module Webpack trước minify:

| Module | kB trước minify |
| --- | ---: |
| `components/system-account-directory.tsx` | 58,2 |
| `app/page.tsx` | 55,8 |
| `components/program-schedule-editor.tsx` | 33,0 |
| `components/lesson-with-notes.tsx` | 21,4 |
| `components/rich-text-toolbar.tsx` | 18,6 |

Kích thước module dùng để truy nguồn; không cộng chúng trực tiếp với số byte truyền tải sau minify/nén.

## Thứ tự tối ưu được số liệu hỗ trợ

1. Tách editor và các hộp thoại sửa/thêm khỏi đường tải ban đầu. Kiểm tra cả import trực tiếp và import qua màn đọc; chỉ lazy-load hộp thoại sẽ chưa loại hết TipTap.
2. Tách màn quản trị tài khoản và các màn nội dung theo route. Hiện các route đều nhập lại `app/page.tsx`, làm ranh giới route chưa tách được phần lớn client bundle.
3. Rà đường nạp Cognito SDK sau khi tách editor, đồng thời giữ thời điểm khôi phục session và refresh token phù hợp. SDK có kích thước nhỏ hơn nhóm editor trong lần đo này.
4. Đo lại với cùng bundler, cấu hình env và thuật toán nén; so sánh lượng JS ban đầu và kiểm tra việc tải editor lần đầu khi mở chức năng.

## Phương pháp và giới hạn

- Build production thành công bằng `node node_modules/next/dist/bin/next build --webpack` với hook thống kê chỉ cho client compiler. Hook đo được gắn tạm thời; `next.config.mjs` và `next-env.d.ts` được khôi phục đúng bytes ban đầu trong `finally`.
- Stats lấy tên module, chunk và kích thước; không xuất source code/module source hoặc giá trị env vào báo cáo.
- Đọc thẻ `script src` trong `out/*.html`, loại trùng và loại script `nomodule`. Polyfill legacy riêng: 112,6 kB chưa nén / 39,5 kB gzip / 35,2 kB Brotli, không cộng vào bảng trình duyệt hiện đại.
- gzip level 9 và Brotli quality 11 được nén riêng từng file rồi cộng. Đây là ước lượng dung lượng sau nén, chưa bao gồm HTTP headers; không phải số byte đo trực tiếp từ CloudFront.
- Không bao gồm HTML/RSC, CSS, font, ảnh, API response hoặc chunk được gọi động sau đó. Không đo tốc độ parse/execute, LCP/INP, mạng thật hay cold start Lambda; chưa có kết luận về mức giảm thời gian tải thực tế.
- JSON đi kèm lưu số byte chính xác, danh sách file theo route, nhóm package theo chunk và module lớn: [bundle-baseline.json](2026-10-31-bundle-baseline.json).
- Script và raw stats của lần đo nằm trong thư mục ignored `.superpowers/bundle-baseline/` của workspace (`build.mjs`, `analyze.mjs`, `client-stats.json`). Không thêm dependency phân tích bundle và không sửa hành vi ứng dụng trong lần đo này.
