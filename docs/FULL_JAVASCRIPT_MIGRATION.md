# Phase 1 chuyển hoàn toàn sang JavaScript

Ứng dụng trên `migration/full-javascript` dùng chung **Node.js + JavaScript/Vite + WebSocket/WebRTC + SQL Server/T-SQL**. Không còn source/project C#/Blazor/SignalR/EF hoặc config chỉ dành cho .NET được theo dõi trên nhánh ứng dụng. Không tạo backend/realtime/UI thứ hai; engine và luật cờ giữ nguyên.

Thống nhất source đã hoàn tất trong phạm vi kiểm chứng. Điều này không đồng nghĩa nghiệm thu mọi môi trường: SMTP hộp thư thật, camera/micro vật lý và NAT/TURN còn BLOCKED. SMTP JavaScript đã có implementation và test local thật, không còn là chức năng chưa triển khai.

## Git và nguồn khôi phục

| Mốc | Ref / commit |
|---|---|
| Đầu vào chứa đầy đủ QA + cleanup | `refactor/safe-cleanup` → `783a20d647d5b008b0b70950d2d92cd8fe721a93` |
| Nhánh sản phẩm mới | `migration/full-javascript`, tách từ 783a20d; không merge/push |
| Archive đầy đủ, gồm cả hai demo đã bỏ ở cleanup | `archive/phase1-dotnet-original` → **`d92474d20a155904274dd93ff87975a325a74580`** |
| Chuyển nghiệp vụ, vẫn còn C# tại thời điểm commit | `5abb2c5` |
| Loại source .NET sau kiểm thử, chuyển tài liệu và thêm guard | `c91e0d8` |
| CLI import từ chối tham số mơ hồ; QA collector theo suite mới | `50dbbc7` |
| Commit bàn giao tài liệu/QA cuối | HEAD của `migration/full-javascript`; hash cụ thể được báo trong bàn giao, tra bằng `git rev-parse migration/full-javascript` |

Đã đọc lại và hash đủ **137 file archive** bằng `git show`, xác minh bản zip Git archive có thể giải nén về cùng nội dung. Archive chứa Core, Infrastructure/services/entities/EF migrations, Web/SignalR/Blazor, Tests, project/config và tài liệu. Không rewrite history; các nhánh main/integration/QA/cleanup/Phase và backup cũ giữ nguyên.

Muốn lấy source cũ để tham khảo, dùng một thư mục kiểm tra riêng hoặc `git archive` từ ref archive, tránh restore cả thư mục vào ứng dụng đang chạy. Ví dụ tạo bản zip mới ngoài cây source; không ghi đè bản lưu đã tồn tại:

```powershell
git -c core.autocrlf=false archive --format=zip --output=phase1-reference.zip archive/phase1-dotnet-original reference/phase1
```

Lệnh chỉ là thao tác xuất archive, không cần .NET. Source cũ cũng còn trong lịch sử và các nhánh gốc; nhánh archive chưa được push theo yêu cầu.

## Phần triển khai mới và phần tái sử dụng

| Phần | Xử lý |
|---|---|
| SMTP từng chỉ có trong C# | `reset-mailer.js` dùng Nodemailer, chọn file/SMTP theo env; gắn vào `createAccounts` của game server hiện có |
| Bảo vệ email/reset | STARTTLS hoặc TLS trực tiếp, kiểm tra cert/CA, SMTP auth, timeout và tối đa 1 – 5 attempts; retry 4xx/network theo backoff. Không retry lỗi vĩnh viễn 5xx; log chỉ thông báo cố định |
| Gửi lỗi hết retry | Vô hiệu token đó, giữ HTTP response giống email không tồn tại/rate-limited; không trả token/SMTP error/credentials cho client |
| Tương thích hash | `passwords.js`: giữ scrypt hiện tại; đọc Identity V2 và V3 PRF SHA1/SHA256/SHA512, so sánh constant-time; chỉ nâng sang scrypt sau xác minh đúng và persistence commit thành công |
| Tài khoản SQL cũ | Công cụ offline dry-run mặc định, map BIGINT gốc → ID Node ổn định, giữ disabled/friends/friend requests, version guard và rollback; không tự chạy trên DB thật |
| Phiên/JWT | Giữ opaque session cookie đang hoạt động, chung HTTP/WS, hết hạn/thu hồi/restart. Không duy trì JWT login song song; JWT/refresh cookie cũ không được chấp nhận |
| EF migrations | `04_phase1_compat.sql` chuyển DDL AddYeuCauChongLap/RegisterIdempotencyIndex; hai Up() khác trống. setup-db giữ 24 bảng/5 view và tạo index thiếu theo cách idempotent |
| Account/friends/Room/invite | Tái sử dụng services/accounts, HTTP routes, game-server action queue và client hiện tại. Giữ Word behavior/contract integration, không port generic DTO/service chỉ để cùng tên |
| SignalR/Blazor | Bỏ framework/protocol/renderer cũ; WebSocket heartbeat/presence, role guards, refresh và WebRTC hiện tại tiếp tục dùng |
| Luật/clock/reconnect/PvP/PvE/history/chat/video | Không viết lại. Giữ engine, state owner, API/WS actions và persistence hiện hành; kiểm thử hồi quy đầy đủ |

Đối chiếu nghiệp vụ và cả 137 file gốc tại [PHASE1_PARITY_MATRIX.md](PHASE1_PARITY_MATRIX.md). Không khẳng định mọi class/API/DTO .NET có bản JS 1:1. Các API cũ không có caller trong sản phẩm (Bearer/JWT refresh, token-link .NET, HTTP idempotency-key .NET) được loại có chủ đích; hành vi chống trùng hiện hành vẫn được test.

## Dữ liệu tài khoản và cơ chế nhập

Ba tài khoản đang sử dụng trong file persistence đều có hash **scrypt**. Hai database nguồn ứng dụng có tên CoTuongOnline/CoTuongIntegration không tồn tại trên instance kiểm tra; không suy luận từ đó rằng mọi database bên ngoài đều không có dữ liệu legacy. Không đăng nhập, thay hash, import hoặc chạy migration trên dữ liệu tài khoản thật trong công việc này.

Fixture ASP.NET V3 lấy nguyên từ `database/02_seed_du_lieu.sql` (mật khẩu seed công khai). Test kiểm tra đúng/sai password, malformed/cost bounds, Unicode, V2/V3 PRF, upgrade identity không đổi, rollback khi save lỗi và opaque session sau reload. Hash ngoài giới hạn an toàn 1.000.000 vòng hoặc salt/subkey ngoài 16 – 128 byte cần kiểm tra riêng, không tự suy diễn mật khẩu hay ép reset hàng loạt.

Với SQL database cũ đã cài schema/integration, dùng **khi cả ứng dụng cũ và mới đã dừng**. Đầu tiên backup DB theo quy trình của bạn, kiểm tra config đang trỏ đúng DB, rồi dry-run:

```powershell
npm.cmd run db:import-phase1
# Có thể giới hạn một hoặc nhiều ID, không in hash/email/token:
npm.cmd run db:import-phase1 -- --user-id=123
```

Chỉ khi đã rà kết quả và dừng server, thao tác apply được yêu cầu rõ ràng bằng:

```powershell
npm.cmd run db:import-phase1 -- --apply --server-stopped
```

Công cụ chỉ nhập các user chưa có integration_user_map trong **cùng DB**, không tạo lại row nguoi_dung, không đổi password hash trong lúc import và không xóa Room/Match/session cũ. Nó giữ quan hệ bạn bè và lời mời kết bạn có đủ hai user được map, từ chối conflict/unsupported hash và kiểm tra version trước commit. Chạy lại không nhập trùng. Flag `--server-stopped` là xác nhận vận hành của người chạy, không phải hệ thống tự phát hiện mọi tiến trình khác.

Không tự chuyển legacy JWT/refresh/reset tokens, Room/Match snapshots hoặc toàn bộ notifications lịch sử thành dữ liệu runtime mới. Các row SQL đó được giữ nguyên để đối chiếu, không bị xóa. Tài khoản import đăng nhập lại bằng mật khẩu cũ để nhận phiên Node; không cam kết tương thích API JWT hoặc hiển thị lại mọi snapshot hệ thống cũ. Hiện không có bằng chứng cấu hình sử dụng thật cần chuyển các snapshot đó; nếu có, cần migration dữ liệu riêng trước cutover. Phiên/tài khoản/lịch sử Node đang sử dụng được giữ và test restart riêng.

## SQL và những file được loại

- Giữ nguyên `01_schema_phase1.sql`, `02_seed_du_lieu.sql`, `03_integration.sql`, SQL nguồn nhánh database, adapter Phase 4 có test; thêm `04_phase1_compat.sql`. Không xóa bảng/view hoặc thay schema game; không DROP/TRUNCATE DB thật.
- Loại **135 path Phase 1 còn lại từ bản cleanup**: 93 `.cs`, 4 `.csproj`, 19 `.razor`, 1 `.slnx`, 2 `.props`, hai appsettings, launchSettings, JS/CSS/favicon của UI cũ, scaffold .NET và source README/script cũ. Trong đó hai tài liệu PHASE1_PLAN/ACCEPTANCE được chuyển nguyên nội dung sang `docs/archive/phase1`; không mất nội dung bàn giao.
- Hai trang Counter/Weather đã được bỏ ở cleanup trước, vẫn có đủ trên archive 137 file. Mọi path cụ thể nằm trong bảng parity và diff commit c91e0d8.
- `99_drop_all.sql` là script phá hủy chỉ còn trên archive, không cần cho Node setup. DDL cần thiết từ EF đã có T-SQL và được test trên DB riêng, không giữ EF để vận hành DB.
- **44 file Bootstrap ngoài Git giữ nguyên byte** theo chỉ dẫn không xóa file ngoài Git. Vì vậy thư mục reference/phase1 có thể vẫn xuất hiện trên máy này với asset ignored; không còn source/config/project .NET trong đó hoặc được theo dõi trên nhánh ứng dụng. Không tự di chuyển/xóa chúng để làm đẹp cây thư mục.
- Nguồn .NET không còn ở các file ứng dụng được Git theo dõi, vẫn hiện trong Git history/archive và các báo cáo tên file; đó là provenance, không phải runtime dependency. Bản thử cài sạch từ công việc cleanup trước còn 119 file source/project .NET ngoài Git dưới `artifacts/cleanup/fresh-install`; giữ nguyên theo chỉ dẫn không xóa file ngoài Git. Chúng không thuộc nhánh ứng dụng, build/deploy hoặc phép kiểm tra source sở hữu; bản cài sạch migration mới có 0 file .NET.

## Cài và chạy không cần .NET

```powershell
npm.cmd ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run dev
```

Mở http://localhost:5173, backend3001. Mặc định DB_MODE=file, MAIL_PROVIDER=file. Build production bằng `npm.cmd run build`, chạy `npm.cmd start` ở cổng 3001. Với SQL, tạo DB riêng rồi cấu hình như README, dùng `npm.cmd run db:setup`; không chạy scaffold/EF/.NET.

SMTP: đặt MAIL_PROVIDER=smtp, APP_PUBLIC_URL trỏ đúng frontend công khai, MAIL_FROM, SMTP_HOST/PORT/USER/PASSWORD. Port587 dùng STARTTLS (`SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=true`), port465 dùng TLS trực tiếp. Chỉ loopback test được cấu hình không TLS; chứng chỉ production luôn được kiểm tra, có thể cung cấp SMTP_TLS_CA_FILE cho CA riêng. Secrets chỉ đặt trong .env/cơ chế secret của môi trường, không đưa vào Git hoặc chat.

`npm.cmd run mail:verify` kiểm tra kết nối/TLS/auth, **không gửi thư**. Để kiểm chứng inbox thật, cấu hình môi trường thử riêng, đăng ký email bạn kiểm soát rồi dùng giao diện Quên mật khẩu; kiểm tra nhận link đúng domain, một lần/15 phút và login mới. Không có SMTP credentials/người nhận trong phiên này nên chưa thực hiện gửi ra ngoài. Cặp cert/key trong test/fixtures chỉ dùng test, tuyệt đối không deploy.

Retry hiện là chuỗi cố gắng có giới hạn trong một HTTP request, cùng token/Message-ID; mất kết nối sau server acceptance có thể dẫn tới email lặp, token vẫn một lần. Không có durable queue hay bảo đảm exactly-once delivery khi process chết. Người dùng có thể yêu cầu lại trong rate limit. Không tuyên bố thay thế một hệ thống mail queue vận hành lớn.

## Giới hạn và kết quả

Hỗ trợ **một Node game process cho mỗi database**. Queue xử lý race join/claim/ready/start/move trong process, SQL version guard chống stale account writer; không có distributed ownership cho Map room, không hỗ trợ multi-worker/active-active. Các ca race/idempotency SQL/WS thật PASS không chứng minh hỗ trợ nhiều worker.

Thêm dependency runtime `nodemailer@10.2.1`, dev `smtp-server@3.21.1`; không nâng các dependency cũ. Không có dependency NuGet/.NET trong graph npm/runtime trước hoặc sau. TLS test dùng chứng chỉ riêng công khai trong fixtures; không tắt certificate verification.

Kết quả trước/sau và bằng chứng tại [MIGRATION_VALIDATION.md](MIGRATION_VALIDATION.md): **196 Node + 9 SQL + 16 Edge PASS**, architecture/build/clean install PASS. Ma trận Word hiện **405 PASS / 4 BLOCKED**, không còn NOT IMPLEMENTED SMTP; hai dòng SMTP cùng phản ánh một hạn chế external delivery. Không tự đóng thiết bị thật hoặc NAT/TURN.
