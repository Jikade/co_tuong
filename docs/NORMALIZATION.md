# Kết quả chuẩn hóa JavaScript

> Báo cáo lịch sử của mốc integration ban đầu. Nhánh migration hiện không còn source .NET và có SMTP JavaScript; kiểm chứng mới tại [MIGRATION_VALIDATION.md](MIGRATION_VALIDATION.md).

Nhánh làm việc: `integration`. Mốc trước thay đổi: `6da0a47`. Nhánh sao lưu `backup/integration-6da0a47` trỏ đúng commit đó, không thay đổi lịch sử main hoặc 5 nhánh phase, không push.

## Kết quả kiến trúc

Frontend: JavaScript/Vite tại `src/client`. Backend: JavaScript/Node tại `src/server`. Realtime: WebSocket tại `server/realtime`. Engine/constants thuần JavaScript tại `src/shared/game`. Authentication/social/history tại `server/services`. File/memory/SQL repositories tại `server/persistence`. HTTP routes/transport tại `server/http`. Cấu hình môi trường và TLS chung cho Node/Vite tại `server/config.js`.

Không có C# nào đang chạy cần chuyển đổi thêm. Root server.js giữ CLI và export createGameServer; core game vẫn giữ một state owner để không thay đổi thứ tự room/match/timer side effect. Không viết lại thuật toán cờ, AI, account service, giao diện hay schema SQL.

HTML, CSS và T-SQL giữ nguyên ngôn ngữ. Source .NET/Blazor/EF/SignalR và test C# giữ nguyên trong reference/phase1. Adapter bridge Phase 4 và SQL nguồn gốc được chuyển vào reference, loại khỏi runtime nhưng vẫn giữ test adapter cũ. Danh sách thành phần và bảng Phase 1 chi tiết ở [SOURCE_AUDIT.md](SOURCE_AUDIT.md).

## Các nhóm commit

| Commit | Nội dung |
|---|---|
| 5e1d12f | Tách client/server/shared, CLI mỏng, lưu adapter/schema cũ vào reference, chỉ cập nhật import test |
| 9cc16fa | Tách HTTP/WS/errors, cấu hình chung, endpoint browser cùng origin, build/check scripts và 7 test mới |
| Commit tài liệu cuối | Cập nhật cây source, biến môi trường, đối chiếu chức năng, hướng dẫn chạy và kết quả |

## So sánh kiểm thử thực tế

| Kiểm tra | Trước chuẩn hóa (chạy lại 6da0a47) | Sau nhóm thư mục | Sau chuẩn hóa runtime |
|---|---|---|---|
| Node unit/integration | 61 PASS, 3 SQL test skip mặc định | 61 PASS, 3 skip | **68 PASS**, 3 skip |
| SQL Server thật, chạy riêng | 3/3 PASS | 3/3 PASS | **3/3 PASS** |
| Edge desktop/mobile | 2/2 PASS | 2/2 PASS | **2/2 PASS** |
| Frontend Vite | PASS | PASS, bundle hash giống baseline | PASS, CSS giữ nguyên; JS giảm nhẹ nhờ bỏ lặp URL |
| Backend | Node tests PASS | Node tests PASS | **build:server PASS** (syntax/import/link), chạy Node trực tiếp |
| Runtime boundaries | Rà soát thủ công | client/server/shared tách riêng | **check:architecture PASS**, không import .NET/legacy hoặc Node API vào browser |
| Dev/proxy | Baseline đã ghi nhận trong VALIDATION | Entry paths mới build/E2E PASS | **PASS** Node 3109 + Vite 5173, cookie/WS có Origin, hai tài khoản tạo/join cùng phòng, logout |

SQL chạy trên `.\SQLEXPRESS`, database test riêng `CoTuongIntegrationTest_20261028_v2`. Không thay schema/data format hoặc xóa dữ liệu. Tests tạo thêm tài khoản/trận thử; giữ dữ liệu các lần trước. Môi trường Node v24.15.0/npm 11.12.1/Edge/Playwright giữ như baseline.

Đã so sánh 9 file `.test.js` gốc với `git show 6da0a47`: sau khi bỏ các dòng import, toàn bộ phần thân/assertion giống nhau. Không bỏ test, không nới assertion hoặc thêm skip. Engine `src/shared/game/xiangqi.js` có nội dung giống hoàn toàn `6da0a47:src/xiangqi.js` (chuẩn hóa CRLF để so sánh). E2E gốc không bị sửa.

7 test mới kiểm tra: cấu hình server/persistence và TLS; cấu hình SQL/pool; endpoint HTTP/WS; malformed JSON và giữ envelope lỗi; cập nhật hồ sơ/notification read đúng quyền; reject/cancel/unfriend; expiry/cancel lời mời phòng. Test hai người chơi, capture/reconnect/restart/replay, clocks, draw/resign, chat privacy, WebRTC giả lập, máy chơi, khán giả và mobile tiếp tục chạy trong bộ gốc.

## Contracts và dependencies

Không đổi HTTP method/path/status/body đang hoạt động, cookie, action/type/requestId hoặc shape room/match/account snapshot. HTTP và WS dùng chung quy tắc lỗi; lỗi riêng của game/chat/video vẫn giữ type cũ. State và persistence dịch vụ không được đưa vào lớp transport.

Không có dependency .NET trong package.json để gỡ: số dependency .NET runtime trước và sau đều **0**. Giữ ws/mssql/Vite/concurrently/Playwright, không nâng phiên bản hoặc đổi dependency graph/lockfile. Đã đưa adapter SQL bridge không dùng ra khỏi src. Script dev dùng public API của concurrently thay đường dẫn bin nội bộ. `preview` chuyển sang cùng Node hosting như start vì vite preview thuần không cung cấp API/cookie/WS.

Boolean môi trường phải là true/false; port/pool phải hợp lệ, cặp TLS bắt buộc đủ hai file; cấu hình sai fail fast. DB_POOL_* nay được áp dụng cho mssql. Đường dẫn data/static/outbox/TLS tương đối tính từ project root, không phụ thuộc nơi import module.

## Khởi chạy

```powershell
npm.cmd ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run dev
```

Mở http://localhost:5173. Bản build: `npm.cmd run build`, rồi `npm.cmd start`, mở http://localhost:3001. Mặc định file storage bền vững; SQL Server setup và test opt-in được hướng dẫn trong README. Không cần cài .NET SDK hoặc chạy dịch vụ C#.

## Giới hạn được giữ từ bản ổn định

SMTP chưa cấu hình, reset-password dùng outbox phát triển. Video mới xác minh với media giả lập, chưa có TURN/camera vật lý/NAT khác nhau. Kết nối SQL thật dùng sqlcmd/Windows Authentication; mssql/SQL login chưa có credentials kiểm thử thật. Social/chat còn lưu snapshot theo thiết kế integration; không tự nhập tài khoản ASP.NET/bridge cũ. Một process cho mỗi database. Các giới hạn này không được tuyên bố hoàn tất bởi việc đổi cấu trúc.
