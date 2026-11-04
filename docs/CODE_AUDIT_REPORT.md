# Kiểm toán source và dọn an toàn

> Mốc lịch sử trước full migration: các quyết định giữ C# bên dưới mô tả nhánh cleanup tại 783a20d. Nhánh ứng dụng mới đã chuyển phần còn thiếu và loại source .NET; xem [FULL_JAVASCRIPT_MIGRATION.md](FULL_JAVASCRIPT_MIGRATION.md).

Mốc gốc được kiểm thử lại: `d92474d20a155904274dd93ff87975a325a74580`, nhánh QA `qa/system-acceptance-20261028`. Working tree sạch trước khi bắt đầu. Sau baseline đã tạo `refactor/safe-cleanup` và `backup/safe-cleanup-d92474d`. Không merge/push, không thay `main`, `integration`, các nhánh Phase hoặc backup cũ.

## Kết quả phạm vi

Đã đọc/kiểm kê toàn bộ **238 file được Git theo dõi tại mốc gốc**, gồm source, cấu hình, scripts, tests, tài liệu và tài nguyên bàn giao. Nội dung text được rà qua entrypoint/đồ thị/chức năng, file binary có hash và nguồn tham chiếu; không coi hash là kiểm thử chức năng. Danh mục đầy đủ tại [CODE_AUDIT_INVENTORY.json](CODE_AUDIT_INVENTORY.json); bảng quyết định từng file tại [UNUSED_FILES_REPORT.md](UNUSED_FILES_REPORT.md).

| Nhóm | Số file gốc | Xử lý |
|---|---:|---|
| A — đang sử dụng | 28 | Giữ toàn bộ runtime/browser/shared và SQL bootstrap hiện hành |
| B — cần giữ | 137 | Giữ test, cấu hình, package/lock, migrations/schema, tài liệu, Word, ảnh QA và adapter tham khảo có test |
| C — legacy có luồng thay thế trong integration | 65 | Giữ: có giá trị đối chiếu và quan hệ nội bộ; chưa chứng nhận tương đương mọi contract |
| D — chắc chắn dư thừa | 2 | Xóa đúng hai trang demo Blazor Counter/Weather |
| E — chưa đủ bằng chứng để bỏ | 6 | Giữ: SMTP, hash/JWT, distributed lock và lời mời cũ |
| **Tổng** | **238** | **Xóa 2 file, giữ 236 file gốc** |

Bỏ thêm hai rule `.legal-move` và `.legal-move.capture` trong `src/client/styles/main.css`; không xóa file CSS. Không có duplicate byte hoàn toàn trong 238 file. Không xóa hay thay test. Không thêm/gỡ/nâng dependency; package.json và lockfile giữ nguyên. Các báo cáo/script kiểm toán mới được kê riêng trong diff Git, không làm sai mẫu 238 file gốc.

Ngoài Git, kiểm tra metadata bằng `git ls-files --others --ignored --exclude-standard`: tại lúc kiểm kê có node_modules 11.151 file, .npm-cache 230, artifacts 933, data 8, dist 3, test-results 3 và 44 asset Bootstrap trong reference. Đây là số tại một thời điểm, đầu ra test tiếp tục phát sinh. Không tuyên bố đã kiểm toán mã nguồn từng dependency/cache hoặc đọc dữ liệu riêng; không xóa file ngoài Git. Các file bí mật `.env`, certs và dữ liệu không phải đối tượng dọn. Không có thay đổi người dùng chưa commit cần xử lý.

## .NET/Blazor và quan hệ phụ thuộc

Mốc gốc có **93 `.cs`, 4 `.csproj`, 1 `.slnx`, 21 `.razor`, 2 `.props`, 2 appsettings JSON**, toàn bộ trong `reference/phase1`. Không thấy `.sln`, `.resx`, `.targets` hay NuGet.config/global.json được theo dõi. `Directory.Build.props` đặt net10.0, Directory.Packages.props quản lý NuGet; 4 project nối Core → Infrastructure → Web/Tests. Có 9 file migration/designer/snapshot EF, RoomHub, notifier/lease/expiry, scaffold, launchSettings và 7 file test/harness C#; giữ nguyên chúng. Sau xóa còn **19 Razor**, số C#/project/migration không đổi.

Luồng chạy: index → main/account-ui + CSS; server.js → game-server → HTTP/account service, WS, history, persistence và shared engine. Build Vite + kiểm tra Node; npm dev dùng concurrently, test dùng node:test/Playwright. Không có API client gọi `/hubs/room`, port .NET, SignalR/EF hay lệnh dotnet trong runtime mới. SQL sqlcmd/ODBC là công cụ database, không phải yêu cầu chạy backend .NET. Adapter mssql được nạp bằng dynamic import, vì vậy phải giữ dependency dù máy này chạy driver sqlcmd.

Không tìm thấy Dockerfile, compose, CI/CD hay pipeline triển khai trong Git hoặc root làm việc; hướng dẫn deployment hiện tại chỉ đóng gói runtime Node/dist/dependencies. Cấu hình hạ tầng nằm ngoài repository không thể được kiểm toán từ đây. C# vẫn có lệnh `dotnet ef` trong scaffold tham khảo và package NuGet; không xóa vì đó là công cụ quản trị nguồn gốc, không bị nhầm với runtime.

[CODE_DEPENDENCY_MAP.md](CODE_DEPENDENCY_MAP.md) ghi 118 cạnh literal, ProjectReference, entrypoint npm/discovery, filesystem SQL, config động, DOM classes và ngoại lệ. `new URL('../../', import.meta.url)` trong config trỏ thư mục gốc, không phải file import thiếu. Không dùng riêng phép tìm import để quyết định xóa.

## Đối chiếu nghiệp vụ Phase 1

| Thành phần cũ | Luồng hiện hành | Xác minh / giới hạn |
|---|---|---|
| Auth/validation, đăng ký/đăng nhập/đăng xuất | services/accounts.js + account-routes.js + account-ui.js | Node/integration/Edge; phiên bền qua file/SQL restart. Không tương thích tự động ASP.NET hash/JWT refresh |
| Quên/reset mật khẩu | accounts.forgot/reset/validResetToken + outbox | Token một lần, expiry/revoke/validation được test. **SMTP thật chưa có**, giữ IEmailSender, SmtpEmailSender, EmailOptions/config và chuỗi project |
| FriendService/Notifications | accounts.social/search/friendRequest/respondFriend/unfriend/readNotification | SQL quan hệ ban_be + HTTP/WS + UI riêng biệt; giữ source DTO/enum/error cũ để đối chiếu |
| RoomService/invite | game-server room actions + account routes | Tạo/join, ready, đổi ghế/host, cap/kick, countdown, invite expiry thực. Integration dùng mã phòng; chưa cam kết contract token/JWT cũ |
| SignalR/lease/notifier | realtime/transport.js + action queue + account/room refresh | WS thật, heartbeat, reconnect/privacy/timer. Một process; chưa tương đương distributed SQL lock |
| EF/DbContext/entities/migrations | T-SQL 01/03 + integration-sql-persistence.js | SQL thật kiểm tra bảng/view/constraint, projection và restart. Giữ toàn bộ EF để tra mapping/lịch sử; không tự áp EF lên DB integration |
| Blazor dashboard/account/Room | account-ui.js/main.js + CSS | Desktop/mobile Edge. Bỏ đúng Counter/Weather là demo SDK, không thay bằng tính năng game |

Sáu file E được ghi tên và lý do riêng trong inventory/report. Những khác biệt trên có trước cleanup, không phải hồi quy do dọn. Không tuyên bố toàn bộ C# đã chuyển tương đương. Source nghiệp vụ còn lại, cấu hình phát triển SMTP và toàn bộ test C# được giữ; không build/nghiệm thu lại ứng dụng Blazor độc lập.

## Các phần chủ động giữ

- SQL nền 24 bảng/5 view, migration integration, seed ASP.NET tham khảo, SQL nguồn nhánh database, EF migrations/scaffold và script nguồn `99_drop_all.sql` (không thực thi).
- `reference/phase4/sql-server-persistence.js` được `test/persistence.test.js` gọi, giữ SQL bridge cùng nguồn; không gộp với adapter integration khác contract.
- Mọi file src có cạnh vào trong đồ thị; không có module mồ côi ở mức file. `getWebSocketUrl` có test dù frontend dùng `getAppEndpoints`; giữ export và test.
- Các style khác, class động/responsive/cascade, tài nguyên nhúng SVG/data URI/canvas, screenshot, Word, QA scripts và bằng chứng. Không lấy một lượt CSS coverage làm căn cứ xóa.
- Cả ws, mssql, Vite, concurrently, Playwright đều có caller/script. Không có dependency .NET trong package.json để gỡ; các PackageReference NuGet còn lại chỉ thuộc source tham khảo.

Kết quả trước/sau, các commit dọn và kiểm tra môi trường sạch ở [CLEANUP_VALIDATION.md](CLEANUP_VALIDATION.md). Không thay trạng thái SMTP/camera thật/NAT-TURN thành PASS; ma trận QA lịch sử được giữ nguyên. Repository vẫn còn legacy và sáu file chưa đủ bằng chứng bỏ, vì vậy **không gọi là sạch 100%**.
