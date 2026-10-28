# Rà soát chuẩn hóa JavaScript

> Mốc chuẩn hóa ban đầu, trước QA/cleanup/full migration. Source C# hiện chỉ còn trên nhánh archive; xem [FULL_JAVASCRIPT_MIGRATION.md](FULL_JAVASCRIPT_MIGRATION.md) cho trạng thái mới.

Mốc so sánh: `6da0a47`, nhánh sao lưu `backup/integration-6da0a47`. Không có code C# trong đồ thị import runtime tại mốc này. Vì vậy công việc chuẩn hóa tái tổ chức và tách trách nhiệm của JavaScript hiện có, không viết lại tài khoản/phòng/bộ luật đã hoạt động.

## Phân loại toàn repository

| Nhóm | Thành phần phát hiện | Quyết định |
|---|---|---|
| Đã thống nhất | Frontend, Node backend, WebSocket, engine PvP/PvE, auth, file/SQL persistence, test Node/Edge đều JavaScript ESM | Giữ logic và contracts của integration |
| Cần chuẩn hóa | src trộn browser/server/shared, server.js vừa CLI vừa HTTP/WS/nghiệp vụ, xử lý lỗi và cấu hình bị phân tán | Tách client/server/shared, CLI mỏng, transport HTTP/WS và cấu hình có module riêng |
| Legacy lưu riêng | Toàn solution C#/Blazor/SignalR/EF, Razor/Bootstrap và test .NET tại reference/phase1 | Giữ nguyên; không có import runtime, không build/deploy cùng Node |
| Legacy lưu riêng | Adapter SQL Phase 4 cũ và script bridge hai bảng, SQL database gốc nằm tại root | Chuyển reference/phase4 và reference/database; giữ nguyên regression test adapter cũ |
| Giữ vì kỹ thuật | HTML, CSS, T-SQL schema/migration, sqlcmd/ODBC, mssql, ws, Vite, Playwright | Không chuyển ngôn ngữ; sqlcmd là CLI SQL Server, không yêu cầu .NET runtime |
| Giữ vì ổn định | Game server giữ Map phòng/match/đồng hồ trong một closure | Tách transport và services nhưng giữ chủ sở hữu state duy nhất, tránh đổi thứ tự side effect |

## Đối chiếu Phase 1

Đã đọc các API trong `reference/phase1/src/CoTuong.Web/Program.cs`, phương thức AuthService/FriendService/NotificationService/RoomInvitationService/RoomService, validation, cấu hình package/project và JavaScript API client cũ. Không có caller của các endpoint C# `/hubs/room` hoặc dịch vụ localhost .NET trong runtime Node/browser.

| Nghiệp vụ C# | Runtime JavaScript tương ứng | Bằng chứng / khác biệt có chủ đích từ bản integration |
|---|---|---|
| Register/Login/Logout, validation và băm mật khẩu | server/services/accounts.js, server/http/account-routes.js | Test đăng ký, trùng tài khoản, đăng nhập sai, logout, hash; scrypt thay ASP.NET PasswordHasher |
| JWT + refresh token | Cookie phiên opaque, kiểm tra cùng repository trên HTTP/WS | Test hết hạn, thu hồi, khởi động lại, reset thu hồi phiên. Không có endpoint JWT refresh; giữ contract integration, không giả vờ tương thích JWT C# |
| Forgot/ResetPassword | accounts.forgot/reset, outbox phát triển | Test token một lần và vô hiệu token cũ/phiên cũ trên memory và SQL; SMTP C# chưa được port, không có gửi email thật |
| Hồ sơ/tên hiển thị, danh sách phiên | GET/PATCH /api/me, /api/auth/sessions | JavaScript đã triển khai; kiểm thử bổ sung cho profile/phiên trong đợt chuẩn hóa |
| Friend search/list, incoming/outgoing, request/accept/reject/cancel/unfriend | accounts.search/social/friendRequest/respondFriend/unfriend | Incoming/outgoing chung trong response /api/friends; API integration khác đường dẫn C# nhưng không phụ thuộc C# |
| Notification list/count/read | accounts.social/readNotification | Đọc /api/notifications; số chưa đọc suy ra từ read flag, không cần gọi CountUnreadAsync |
| Room create/public/join/link/ready/start/snapshot | WebSocket actions + GET /api/rooms/public + link ?room=CODE | Test hai người chơi, HTTP/WS, ready/start, reconnect; mã phòng thay invite token riêng của Phase 1 |
| BecomeOpponent/RemoveOpponent/Leave/Kick/chuyển chủ | Cùng state phòng trong server/game-server.js | Test ghế, quyền, ban, rời phòng và host transfer |
| Room invite/send/respond/cancel/expiry | accounts.invite/respondInvite + account routes | Test người gửi/người nhận, online presence và expiry; pending quá hạn không được hiển thị hoặc accept |
| EF migrations/DbContext | server/persistence và database/*.sql | 3 test SQL thật, dữ liệu integration map UUID → BIGINT. Không chạy EF trên database integration |
| SignalR notifier/connection lease/room lock | WebSocket, peers/connections Map, hàng đợi action trong một tiến trình | Test quyền chat/video, thay tab, disconnect/reconnect; không có distributed room lock hoặc cluster |

Các khác biệt đã có trong `6da0a47` được giữ lại, không phải mất chức năng do chuẩn hóa. Các giới hạn SMTP/TURN, SQL projection xã hội dạng snapshot, chưa tự nhập tài khoản ASP.NET và vận hành một worker tiếp tục được công bố trong INTEGRATION.md.

## Dependencies và contracts

`package.json` chỉ có dependencies JavaScript: ws, mssql, Vite, concurrently, Playwright. Không có package/tiến trình .NET để gỡ khỏi runtime. Các PackageReference NuGet chỉ tồn tại trong reference/phase1 và được bảo toàn cùng source gốc. Không nâng phiên bản thư viện hoặc đổi lockfile phụ thuộc trong đợt tổ chức lại này.

Giữ export `createGameServer` tại root server.js cho CLI/test caller. Giữ method/path/status/body của HTTP, cookie cotuong_session, WS action/type/requestId và shape snapshot. Đường dẫn module nội bộ được cập nhật theo thư mục mới. Các test gốc chỉ thay import, không bỏ assertion hay thay tiêu chí PASS.
