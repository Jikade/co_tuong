# Kiểm chứng migration JavaScript

## Mốc và môi trường

Đầu vào `783a20d` chứa toàn bộ QA và cleanup. Archive `archive/phase1-dotnet-original` trỏ đúng `d92474d20a155904274dd93ff87975a325a74580`, đủ 137 file gốc. Nhánh làm việc `migration/full-javascript`; commit nghiệp vụ `5abb2c5`, loại .NET `c91e0d8`, CLI/QA tooling `50dbbc7`, tài liệu chốt sau đó. Không merge/push hoặc thay nhánh nguồn.

Windows, Node v24.15.0/npm 11.12.1, Vite 5.4.21, Edge headless qua Playwright. SQL Express `.\SQLEXPRESS`, driver sqlcmd/Windows Authentication. Python/PowerShell/Git chỉ là công cụ kiểm tra/tài liệu; ứng dụng và test tự động là JavaScript, không cần .NET SDK/runtime.

## Kết quả thực thi

| Bộ kiểm tra | Baseline 783a20d | Sau chuyển nghiệp vụ, trước xóa C# | Sau xóa .NET |
|---|---|---|---|
| Node mặc định | 177 PASS, 7 SQL skip, 0 FAIL | 196 PASS, 9 SQL skip, 0 FAIL | **196 PASS, 9 skip, 0 FAIL** |
| SQL thật | 7/7 PASS | 7/7 gốc + 2/2 migration PASS | **9/9 PASS**, 0 skip |
| Edge nền | 4/4 PASS | 4/4 PASS | **4/4 PASS** |
| Edge QA | 12/12 PASS | 12/12 PASS | **12/12 PASS** |
| Architecture + build backend/Vite | PASS | PASS | **PASS**, thêm guard chặn source/config .NET trong cây ứng dụng |
| Cài sạch theo lockfile | npm ci offline + architecture/build PASS | Không cần dựng lại giữa hai nhóm | **113 package cài offline**, architecture/build + 196 Node PASS |
| CLI production host trên bản cài sạch | Đã kiểm chứng ở cleanup; không dùng làm kết quả mới | — | **PASS** PvP + AI + histories/replays + session/history sau restart trên file riêng |

196 Node =177 bài cũ +19 bài SMTP/hash mới; SQL 9 =7 bài cũ +2 bài migration. Tổng **221 bài PASS độc lập** =196+9+16; không cộng rerun/clean install thành test mới. Node phát hiện 205 bài, skip 9 SQL mặc định để bảo vệ database; cả 9 đã chạy thật riêng. Không xóa hoặc nới test/fixture/timeout/điều kiện PASS cũ.

Các bundle frontend trước/sau migration có cùng hash/tên: CSS index-B5sm-ucY.css và JS index-DAD9UwC0.js. Không sửa game engine, luật, client UI hoặc contract hiện hành để port lại các lớp C#. Package/lock chỉ thêm Nodemailer và SMTP test dependencies, không nâng thư viện cũ.

## Bằng chứng mới cho Phase 1

- `test/mail.test.js` — **8 bài**: validation config/TLS/credential/URL/bounds; STARTTLS và implicit TLS thật với certificate verification + authentication; transient451 retry rồi gửi; permanent550 không retry; thiếu STARTTLS bị từ chối; HTTP forgot→SMTP→one-use reset→old session bị thu hồi; exhausted retries vô hiệu token, response không phân biệt email và log chỉ chuỗi cố định.
- `test/password-migration.test.js` — **11 bài**: fixture ASP.NETV3 từ seed SQL gốc; V2/V3 PRF vectors; sai/malformed/excessive KDF; Unicode/scrypt; login đúng mới nâng hash, ID giữ nguyên, session reload/logout; save lỗi không phát sinh hash/session; disabled không login/reset; concurrent reset chỉ một lần thành công.
- `test/migration-sql.test.js` — **2 bài SQL thật**: dựng schema 24 bảng không có tableidempotency, nâng bằng setup/TSQL04 hai lần giữ nguyên user row và đủ index/view; importer dry-run không ghi, từ chối apply thiếu điều kiện dừngserver, map cùng BIGINT/hash/disabled/friends/pending request, lặp không trùng, login nâng đúng một user, Node session dùng lại sau server restart; token JWT cũ bị từ chối.
- Bộ cũ giữ đầy đủ: accounts/social/invite/room/role/host, WS quyền và race/idempotency, rules/clock/AFK/reconnect, draw/resign, privacy/chat/WebRTC giả lập, cả hai màu AI, autosave/history/replay, desktop/mobile, file và SQL restart.

Định dạng hash dựa trên [source chính thức Microsoft](https://github.com/dotnet/aspnetcore/blob/main/src/Identity/Extensions.Core/src/PasswordHasher.cs); fixture seed có sẵn từ C# gốc. Các PRF vectors khác lắp từ định dạng bằng JS, không giả định chạy C# để sinh. SMTP APIs theo [Nodemailer](https://nodemailer.com/smtp) và [SMTP Server](https://nodemailer.com/extras/smtp-server). Đây là nguồn định dạng/API, không thay bằng chứng thực thi test.

## SQL và tài khoản thật

7 bài gốc dùng đúng `CoTuongIntegrationTest_QA_20261028`. Hai bài mới dùng DB riêng có prefix `CoTuongIntegrationTest_Migration_20261028_Accounts` và `..._Schema_<random>`. DB schema test tạo mới để chứng minh đường nâng từ 24 bảng; giữ các DB làm bằng chứng, không DROP/TRUNCATE/cleanup dữ liệu. Bộ gốc tiếp tục xác nhận 24 bảng/5 view, constraints/trustedFK, normalized friends/moves/capture/result/creator, idempotency và stale writer rollback.

Tài khoản thực đang dùng: 3 user file/scrypt; không áp importer, không đăng nhập để nâng hash, không ghi SQL migration lên DB thực. Kiểm tra tồn tại hai DB nguồn dự kiến CoTuongOnline/CoTuongIntegration không thấy trên instance này; không kiểm tra/xử lý các DB không thuộc dự án. Không suy luận người dùng ngoài môi trường này đã được migrate.

Bản cài sạch ở `artifacts/migration/final-install`: source/config/tests, không copy .env/data/.git/node_modules/dist cũ. npm ci offline cài 113 package, chạy architecture/build/Node 196 PASS. CLI riêng cổng 3114, DATA_FILE riêng trong bản sao: hai tài khoản giả chơi PvP một nước/đầu hàng, người Đen chơi máy mở đầu/đầu hàng, hai history/replay; restart cùng cookie/history vẫn đúng. Đây là cài sạch dependencies trên cùng Windows/cache, không phải kiểm thử mọi OS hoặc hệ thống production mới.

Ứng dụng chính đã khởi động lại bằng `npm.cmd run dev` sau khi xác nhận 0 trận đang chơi. Edge read-only tại localhost:5173 hiển thị login, health200/file/ok, không pageerror. Hash toàn bộ accounts và matches bằng mốc trước migration; mã hai phòng giữ nguyên, vẫn 3 user/2 Room/1 lịch sử. Không nhập dữ liệu hoặc đăng nhập tài khoản thật. Bằng chứng `final/live-check.json`, `live.log`, `live-login.png`; bản migration mới hiện chạy trên 5173/3001.

## Các lần lỗi được điều tra, không bỏ test

- Test đọc email ban đầu bắt token chưa giải mã MIME quoted-printable soft line break, nên token bị cắt. Đã sửa parser test và assert token đủ 43 ký tự; SMTP/HTTP test PASS, không đổi transport hay tiêu chí token để né lỗi. Log `pre-removal/mail-parser-before.log` giữ nguyên.
- Fixture schema cũ ban đầu chạy CREATE VIEW sau các SET do driver thêm, rồi truyền CONVERT trực tiếp cho EXEC. Đã dùng batch variable + sp_executesql giống setup-db hiện hành; không đổi schema/constraint hoặc bỏ case. Log `sql-batches-before.log`, `sql-exec-parameter-before.log` giữ.
- Lượt hồi quy cuối đầu tiên có Node 195 PASS/1timeout và SQL 8 PASS/1timeout. Windows System log ghi Kernel-Power 42/107 lúc **18:39:59** và Power-Troubleshooter 1 lúc **18:43:49**: máy sleep/wake trong lúc các ca clock/WS chạy. Không coi lượt đó PASS; lưu node-timeout-before.log/sql-timeout-before.log/power-events.json. Chạy lại nguyên Node 196 vàSQL 9 sau khi máy thức đềuPASS, timeout/assertion không đổi. Edge 16 và clean install cũngPASS.
- PowerShell có thể biểu diễn stderr “.env not found. Continuing without it.” thành NativeCommandError; script luôn propagate native `$LASTEXITCODE`, không dựa riêng cảnh báo đó để đánh giá PASS. Không tạo .env chứa secrets chỉ để làm mất cảnh báo.
- CLI import từ chối tham số lạ hoặc kiểu tách `--user-id 123`, yêu cầu `--user-id=123` để tránh vô tình nhập toàn bộ. Probe invalid-args trả exit1 trước truy cập DB; lỗi hoàn tất không khẳng định sai rằng transaction chắc chắn chưa commit khi transport có thể mất phản hồi. Log `final/import-cli-invalid.log`.

## Source/archive và bằng chứng local

Archive137 file đã đọc lại/kiểm tra SHA256 bằng Git; zip archive được kiểm tra nội dung trong bộ nhớ. Không extract C# vào source ứng dụng. Loại 135 path Phase 1 còn lại từcleanup, chuyển 2 tài liệu; còn 0 tracked .cs/.csproj/.sln/.slnx/.razor/.props/config.NET và 0 tracked reference/phase1. Guard architecture còn kiểm tra toàn cây source sở hữu, loại dependency/cache/data/build/artifacts khỏi phép dò.

Bản zip theo core.autocrlf mặc định có CRLF của Windows; đã giữ bản đó và tạo thêm `phase1-dotnet-original-d92474d-canonical.zip` bằng tùy chọn Git `-c core.autocrlf=false`. Cả 137 entry trong bản canonical khớp chính xác SHA256 blob nguồn. Kết quả tại archive-restore-check.json, SHA256 zip `a29cde2c272b53614608dd2f1bbd6487e64167cd6ad1ff27148cec9d81926e0a`. Không thay cấu hình Git toàn cục.

44 Bootstrap asset ngoài Git giữ nguyên hash; folder ignored reference/phase1 có thể còn trên máy, không có .NETproject/source trong đó. Riêng bản cài thử cleanup trước nằm dưới artifacts/cleanup/fresh-install còn 119 file .NET ignored, không tự xóa theo chỉ dẫn bảo vệ file ngoài Git. Chúng không được đóng gói vào nhánh/build hoặc bản cài sạch migration mới. Source trong Git history/archive, QA artifact hoặc tên file trong báo cáo không phải dependency/runtime của nhánh mới.

| Thư mục local ignored | Nội dung |
|---|---|
| `artifacts/migration/baseline/` | Node/SQL/Edge/build/architecture/cài sạch trước migration |
| `artifacts/migration/pre-removal/` | Node 196, SQL 7+2, Edge 16, build/architecture sau port trước xóa C# |
| `artifacts/migration/final/` | Node 196, SQL 9, Edge 16, clean install/build/tests, kết quả QA hiện tại và log lỗi đã giữ |
| `artifacts/migration/archive-verified.json`, `archive-restore-check.json`, `phase1-dotnet-original-d92474d-canonical.zip` | Hash từng file và bản export archive khôi phục khớp 137 entry, chỉ ở local |
| `phase1-full-read.json`, `phase1-removal-manifest.json`, `untracked-assets-before.json` | Danh mục đọc/loại và hash asset ngoài Git |
| `live-before.json` và kết quả live-check cuối | Hash tài khoản/lịch sử trước/sau, không ghi giá trị password/token vào báo cáo |

Không commit raw outbox, cookie, tokens, SMTP credentials, data hoặc node_modules. Cặp PEM trong test/fixtures là key test công khai, không được deploy.

## Chạy lại

```powershell
npm.cmd ci
npm.cmd run check:architecture
npm.cmd run build
npm.cmd test
npm.cmd run test:migration
npm.cmd run test:e2e
npm.cmd run test:qa:e2e
```

SQL riêng, không dùng DB thực:

```powershell
$env:DB_DRIVER='sqlcmd'
$env:DB_SERVER='.\SQLEXPRESS'
$env:DB_DATABASE='CoTuongIntegrationTest_QA_20261028'
$env:RUN_SQL_TESTS='true'
npm.cmd run test:qa:sql
Remove-Item Env:RUN_SQL_TESTS,Env:DB_DRIVER,Env:DB_SERVER,Env:DB_DATABASE
```

Để xuất lại ma trận từ log migration cuối trên máy này:

```powershell
$env:QA_LOG_DIR='artifacts/migration/final'
node scripts/qa/collect.js
npm.cmd run qa:report
Remove-Item Env:QA_LOG_DIR
```

Collector kiểm summary196 Node/9 SQL/4+12 Edge/build trước khi ghi mapping. Không dùng các file timeout làm bằng chứng cuối. Chưa có artifact trên máy mới thì phải chạy tests/lưu log tương ứng trước, không lấy báo cáo đã commit thay cho kết quả mới.

## Giới hạn chưa được đóng

- **SMTP hộp thư thật BLOCKED**: implementation/TLS/auth/retry/local SMTP và HTTP reset đãPASS; thiếu config/credentials/người nhận để xác minh delivery ngoài môi trường local. mail:verify chỉ chứng minh kết nối/auth, không phải inbox.
- **Camera/micro vật lý BLOCKED**, **NAT/TURN hai mạng BLOCKED**: giữ phạm vi fake media/local cũ, không suy ra từ đổi ngôn ngữ.
- **Single process**: race/idempotency trong Node và SQL version guard được test; không hỗ trợ active-active/multi-worker. Không chuyển SQL distributed Room lock chỉ để giữ tên C# nếu sản phẩm chưa hỗ trợ cluster.
- **Driver SQL**: kết nối thật đã kiểm chứng bằng sqlcmd/Windows Authentication. Driver mssql/SQL login vẫn có code/dependency, chưa có credentials để kiểm chứng kết nối thật trong lần này.
- **Legacy data**: hỗ trợ hash và importer có giới hạn đã công bố, không tự chuyển mọi legacy Room/Match/notification/session. Không giả vờ JWT/API cũ còn tương thích.
- npm audit online hiện ghi5advisory trên các dependency cũ (Azure/MSAL, Vite/esbuild/source-map-js); không có advisory được báo cho hai packageSMTP mới. Không nâng Vite major hoặc audit-fix-force trong migration ổn định này. Kết quả “ 0 vulnerabilities” của npm ci offline không được dùng làm kết luận security audit. Chi tiết local: `artifacts/migration/npm-audit.json`.

Ma trận Word hiện **405 PASS, 4 BLOCKED, 0 FAIL/NOT IMPLEMENTED/NOT TESTED**. Hai dòng BLOCKED SMTP cùng một khả năng delivery thực; hai dòng còn lại thiết bị và mạng. Đã thống nhất source và vượt hồi quy trong phạm vi trên, chưa nghiệm thu mọi môi trường production.
