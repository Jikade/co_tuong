# Cờ Tướng Online — JavaScript

Ứng dụng thống nhất từ 5 phase: tài khoản → trang chủ → tạo/vào phòng → thi đấu realtime → kết quả → lịch sử/replay. Runtime là Node.js + Vite + WebSocket; không cần chạy backend .NET riêng.

Phiên bản hiện tại trên `migration/full-javascript` đã chuyển phần còn thiếu của Phase 1 và loại source/project C#/Blazor/SignalR/EF khỏi nhánh ứng dụng. Xem [migration](docs/FULL_JAVASCRIPT_MIGRATION.md), [đối chiếu Phase 1](docs/PHASE1_PARITY_MATRIX.md), [kiểm chứng trước/sau](docs/MIGRATION_VALIDATION.md). SMTP Node đã triển khai và test bằng SMTP server local có TLS; gửi đến hộp thư thật, camera/micro vật lý và NAT/TURN vẫn **BLOCKED/chưa nghiệm thu đầy đủ**.

Theo kịch bản đã đối chiếu: mỗi Match phân ngẫu nhiên Đỏ/Đen một lần; chọn quân chỉ highlight, không gợi ý ô đi; Chia Room mở URL và nút Sao chép link trong ứng dụng. Các chức năng này đã sửa trên nhánh QA, chưa merge vào `integration`.

Các mốc QA/cleanup trước được giữ trong [QA_FINAL_REPORT.md](docs/QA_FINAL_REPORT.md), [CODE_AUDIT_REPORT.md](docs/CODE_AUDIT_REPORT.md), [UNUSED_FILES_REPORT.md](docs/UNUSED_FILES_REPORT.md), [CLEANUP_VALIDATION.md](docs/CLEANUP_VALIDATION.md). Kết luận “giữ source C#” và “SMTP chưa triển khai” trong các bản lịch sử mô tả đúng thời điểm đó; migration mới thay chúng bằng archive Git và SMTP JavaScript.

## Cấu trúc JavaScript

```text
server.js                  # CLI + export createGameServer tương thích
src/
  client/                  # Frontend Vite, tài khoản/UI, WebRTC, styles
  shared/game/             # Engine cờ và constants dùng chung browser/server
  server/
    game-server.js         # Chủ sở hữu phòng/trận/đồng hồ/PvE
    config.js              # Cấu hình môi trường chung cho Node và Vite
    errors.js              # Lỗi HTTP/WS, giữ nguyên shape response
    http/                  # Routes, request/cookie, response, static hosting
    realtime/              # WebSocket upgrade/auth/JSON, quản lý socket
    services/              # Tài khoản/xã hội/lịch sử, password và SMTP
    persistence/           # File, memory và SQL Server
database/                  # Schema/migration T-SQL đang sử dụng
scripts/                   # Dev, kiểm tra build/kiến trúc, setup database
test/                      # Unit/integration Node (JavaScript)
e2e/                       # Playwright desktop/mobile (JavaScript)
reference/                 # Chỉ còn adapter SQL Phase 4 có test và SQL nguồn
```

Tất cả module ứng dụng dùng JavaScript ESM. HTML/CSS/T-SQL được giữ đúng vai trò. Source Phase 1 đầy đủ chỉ còn trên nhánh Git `archive/phase1-dotnet-original` tại `d92474d`; hai tài liệu lịch sử chuyển sang `docs/archive/phase1`. Không cần .NET SDK/runtime để cài, build, test hoặc chạy ứng dụng.

## Chạy nhanh trên Windows

Yêu cầu **Node.js 24 trở lên**. Trong PowerShell tại thư mục `cotuong`:

```powershell
npm.cmd ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run dev
```

Mở **http://localhost:5173**. Đăng ký hai tài khoản bằng hai profile trình duyệt (hoặc một cửa sổ thường, một cửa sổ InPrivate). Hai tab cùng profile dùng chung cookie đăng nhập.

Mặc định `DB_MODE=file`: tự tạo `data/integration.json`, lưu tài khoản, phiên, phòng, trận và lịch sử qua lần khởi động lại. `DB_MODE=memory` chỉ dành cho test, dữ liệu mất khi dừng tiến trình. Không commit `.env`, `data/` hoặc chứng chỉ.

Tạo phòng hoặc vào bằng mã 6 chữ số/link `/?room=123456`. Hai đấu thủ chọn **Sẵn sàng**, chủ phòng chọn **Bắt đầu**. Bên Đỏ đi trước, mỗi lượt 60 giây. Server kiểm tra toàn bộ nước đi. Người thứ ba là khán giả (tối đa 10); khán giả không nhận chat/video của hai đấu thủ.

Trong phòng chờ, khán giả có thể nhận ghế đối thủ trống; chủ phòng có thể chuyển đối thủ xuống khán giả hoặc mời khán giả rời phòng. Khi chủ phòng rời, quyền chủ chuyển cho đối thủ/khán giả còn lại. Trong trận, rời trận hoặc đầu hàng tính thua; mất kết nối tạm dừng đồng hồ và có cửa sổ quay lại 60 giây. Nút tài khoản/bạn bè vẫn dùng được trong phòng.

## Build và chạy bản production tại máy

```powershell
npm.cmd run build
npm.cmd start
```

Mở **http://localhost:3001**. Node phục vụ `dist/`, API và `/ws` cùng origin. `npm.cmd run preview` cũng chạy Node như `start`, để đăng nhập/WebSocket hoạt động; không gọi `vite preview` trực tiếp. Khi dùng reverse proxy, chuyển tiếp cả HTTP và WebSocket, giữ nguyên Host/Origin và ưu tiên TLS trực tiếp hoặc cấu hình TLS tới Node; cookie trên HTTPS cần Secure. Không chạy nhiều game server trên cùng database.

`build` gồm `build:server` (kiểm tra cú pháp JavaScript, resolve/link module và ranh giới runtime) và `build:client` (Vite tạo `dist/`). Backend chạy ESM trực tiếp bằng Node, không cần transpile hoặc .NET SDK. Khi deploy, cần `server.js`, `src/server/`, `src/shared/`, `dist/`, package.json/lockfile và dependencies; không cần thư mục `reference/`.

Vite dev proxy `/api`, `/health`, `/ws` tới Node nên cookie xác thực dùng cùng origin trên cổng 5173. Không đặt `VITE_WS_URL` sang một origin khác; server kiểm tra Origin và cookie. Biến `PORT` đổi cổng backend, được dev proxy đọc cùng lúc khởi động.

`src/server/config.js` đọc và kiểm tra `PORT`, cặp TLS, lựa chọn persistence và cấu hình SQL. `DATA_FILE`, `STATIC_DIR`, `MAIL_OUTBOX`, đường dẫn chứng chỉ tương đối được tính từ thư mục dự án. Boolean dùng `true`/`false`; cấu hình sai bị từ chối ngay. `APP_HOST` mặc định `0.0.0.0`; `DB_POOL_*` được dùng bởi driver mssql. Các lệnh dev/start/build/db:setup nạp `.env` bằng Node; biến môi trường terminal có ưu tiên cao hơn file.

## SQL Server Express với tài khoản Windows

Ứng dụng không tự tạo/xóa database. Tạo một database riêng khi chưa tồn tại:

```powershell
sqlcmd -S '.\SQLEXPRESS' -E -C -b -Q "IF DB_ID(N'CoTuongIntegration') IS NULL CREATE DATABASE CoTuongIntegration COLLATE Vietnamese_100_CI_AS;"
```

Sửa `.env`:

```dotenv
DB_MODE=sqlserver
DB_DRIVER=sqlcmd
DB_SERVER=localhost\SQLEXPRESS
DB_DATABASE=CoTuongIntegration
DB_AUTO_MIGRATE=false
```

Sau đó:

```powershell
npm.cmd run db:setup
npm.cmd run dev
```

Cần `sqlcmd` và ODBC Driver cho SQL Server trên PATH. `sqlcmd` dùng Windows Authentication, không cần DB_PASSWORD. Có thể đặt `SQLCMD_PATH` nếu chương trình không nằm trên PATH.

Máy khác có thể dùng `DB_DRIVER=mssql`, `DB_SERVER`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` với SQL Authentication và TCP/IP được bật. Driver này chưa được kiểm thử kết nối thật trong phiên tích hợp; Windows/sqlcmd đã kiểm thử thật. Tài liệu tham số sqlcmd: [Microsoft Learn](https://learn.microsoft.com/en-us/sql/tools/sqlcmd-utility).

`db:setup` chỉ cài schema gốc khi database trống, chạy các batch trong transaction, và từ chối database có schema một phần/không phù hợp. Với schema nền đầy đủ, nó thêm các bảng integration và chạy `04_phase1_compat.sql` để bảo toàn table/index của EF cũ; chạy lại không xóa dữ liệu. Schema nền có **24 bảng, 5 view**, Phase 1 thêm bảng idempotency, integration thêm mapping/snapshot. `DB_AUTO_MIGRATE=true` chỉ thêm bảng integration, không tự cài lại schema nền.

Tài khoản Node đang dùng tiếp tục hoạt động. Với tài khoản ASP.NET chưa được map trong cùng SQL database, `npm.cmd run db:import-phase1` chỉ dry-run; áp dụng cần dừng cả ứng dụng cũ/mới và thêm `-- --apply --server-stopped`. Không tự chạy import trên dữ liệu thật. Hash Identity V2/V3 được xác minh bằng JavaScript, chỉ nâng sang scrypt sau đăng nhập đúng và commit thành công. JWT/refresh cookie cũ yêu cầu đăng nhập lại, không được nhận làm credential Node. Phạm vi/giới hạn nhập dữ liệu ở [FULL_JAVASCRIPT_MIGRATION.md](docs/FULL_JAVASCRIPT_MIGRATION.md).

Tài khoản đã có từ backend .NET và hai bảng bridge Phase 4 không được tự chuyển đổi. Dùng database integration riêng; nhập tài khoản/phiên cũ cần migration được kiểm tra riêng. Chi tiết bảng đang dùng: [docs/INTEGRATION.md](docs/INTEGRATION.md).

## Tài khoản, bạn bè và khôi phục mật khẩu

Mật khẩu băm scrypt với salt riêng; cookie phiên HttpOnly/SameSite=Strict; token phiên và token đặt lại chỉ lưu hash. Phiên có hạn 7 ngày; đăng xuất/thu hồi/đổi mật khẩu vô hiệu phiên tương ứng cả trên WebSocket.

Mở **Tài khoản & bạn bè** để sửa tên, thu hồi phiên khác, tìm người chơi, kết bạn, xem thông báo và mời bạn đang online vào phòng còn ghế trống. Dữ liệu xã hội làm mới mỗi 15 giây hoặc khi có thao tác.

Mặc định `MAIL_PROVIDER=file`: bản tin `{email, token}` nằm trong `data/outbox/*.json` (hoặc `MAIL_OUTBOX`), không trả token qua HTTP. Mở `http://localhost:5173/?reset=TOKEN` để đặt mật khẩu mới; token hết hạn sau 15 phút, dùng một lần và vô hiệu các phiên cũ.

Để gửi SMTP, đặt `MAIL_PROVIDER=smtp`, `APP_PUBLIC_URL`, `MAIL_FROM`, `SMTP_HOST/PORT/USER/PASSWORD` trong `.env`; xem `.env.example`. Port 587 thường dùng `SMTP_SECURE=false` và `SMTP_REQUIRE_TLS=true` (STARTTLS); port 465 dùng `SMTP_SECURE=true`. Chứng chỉ luôn được xác minh. `npm.cmd run mail:verify` chỉ kiểm tra kết nối/TLS/auth, không gửi thư. Sau đó test luồng Quên mật khẩu bằng email của bạn trên môi trường thử; chưa có bằng chứng delivery đến hộp thư thật trong lần migration này. Retry có giới hạn, không có hàng đợi email nền bền vững.

## Video và kiểm thử hai thiết bị

Thanh icon bên phải mở/đóng Chat, Video, Nước đi, Lịch sử và Khán giả. Video dùng WebRTC, có chấp nhận/từ chối, hết hạn lời gọi 60 giây, kết thúc cuộc gọi và bật/tắt camera/micro.

Camera/micro chạy trên `localhost` hoặc HTTPS có chứng chỉ được tin cậy. Trên LAN, tạo chứng chỉ cho địa chỉ máy bằng mkcert, tin cậy CA trên hai thiết bị và đặt cả hai biến:

```powershell
$env:TLS_CERT_FILE = (Resolve-Path certs/lan.pem).Path
$env:TLS_KEY_FILE = (Resolve-Path certs/lan-key.pem).Path
npm.cmd run dev
```

Chỉ đặt một biến sẽ bị từ chối khởi động. Không chia sẻ private key. Cuộc gọi đã kiểm thử trên hai browser context Edge với camera/micro giả lập; chưa kiểm thử camera vật lý hoặc mạng Internet có NAT. Chưa có TURN; cần bổ sung TURN trước khi cam kết video trên mọi mạng.

## Kiểm thử

```powershell
npm.cmd run check:architecture
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run test:qa:e2e
```

`check:architecture` kiểm tra import/cú pháp, chặn frontend nhập backend, shared nhập Node API và runtime nhập archive/.NET. Các test gốc vẫn giữ assertion; thêm test cho cấu hình, envelope lỗi HTTP/WS và các thao tác Phase 1.

E2E dùng Microsoft Edge headless đã cài sẵn; có thể đặt `BROWSER_PATH` tới Chromium tương thích. Suite nền có 4 bài (cả layout), suite QA có 12 bài với bốn phiên độc lập, spectator, privacy, offline, Word/reset, AI/replay và media giả lập. Server test dùng cổng 3107/3108 và memory riêng; suite QA có hai lần chờ 60 giây thực nên chạy vài phút. Ảnh/log nằm trong `test-results/` và `artifacts/qa/`.

SQL integration chỉ chạy khi bật rõ ràng và tên database bắt đầu bằng `CoTuongIntegrationTest_`:

```powershell
sqlcmd -S '.\SQLEXPRESS' -E -C -b -Q "IF DB_ID(N'CoTuongIntegrationTest_local') IS NULL CREATE DATABASE CoTuongIntegrationTest_local COLLATE Vietnamese_100_CI_AS;"
$env:DB_DRIVER = 'sqlcmd'
$env:DB_SERVER = '.\SQLEXPRESS'
$env:DB_DATABASE = 'CoTuongIntegrationTest_local'
$env:RUN_SQL_TESTS = 'true'
npm.cmd run test:sql
Remove-Item Env:RUN_SQL_TESTS,Env:DB_SERVER,Env:DB_DATABASE,Env:DB_DRIVER
```

Test SQL tự kiểm tra/tạo schema trong database test trống và thêm tài khoản/trận test mới, không tự dọn/xóa database. Đừng trỏ test tới database đang dùng.

Kết quả và phạm vi xác minh thực tế: [docs/VALIDATION.md](docs/VALIDATION.md). Bảng phase, conflict và các giới hạn: [docs/INTEGRATION.md](docs/INTEGRATION.md). Quyết định kiến trúc: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Kịch bản chức năng gốc giữ tại [docs/ORIGINAL_REQUIREMENTS.md](docs/ORIGINAL_REQUIREMENTS.md).

Lượt QA dùng Word [docs/KICH_BAN_CHUC_NANG.docx](docs/KICH_BAN_CHUC_NANG.docx). `test:qa:sql` hiện chạy **9 bài**: 7 bài gốc trên `CoTuongIntegrationTest_QA_20261028`, thêm 2 bài migration trên DB riêng có prefix `CoTuongIntegrationTest_Migration_20261028_`. Các DB test được giữ làm bằng chứng, không tự dọn/xóa. Lệnh và kết quả mới ở [MIGRATION_VALIDATION.md](docs/MIGRATION_VALIDATION.md); VALIDATION/NORMALIZATION/cleanup ghi mốc lịch sử.
