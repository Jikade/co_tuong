# Sửa độ trễ SQL room snapshot

## Nguyên nhân và thay đổi

Ở mốc `4fcda32`, `rooms.saveAll()` đặt tất cả room thành inactive rồi ghi lại toàn bộ room/match/pieces, kể cả trận đã kết thúc. Trên database QA tích lũy, một thay đổi ready tạo khoảng 1,6 MB T-SQL. Trace ghi nhận hai transaction countdown/playing mất khoảng 8,0 + 7,5 giây, vượt timeout WebSocket 15 giây. Server có nhận action và client có nhận broadcast; action queue phải chờ transaction xong. Các mẫu DMV không có blocking session, deadlock counter bằng 0; CPU SQL gần bằng elapsed time.

Adapter SQL hiện so sánh snapshot với bản đã commit gần nhất và chỉ project các room thay đổi. Chỉ các room bị loại khỏi snapshot mới bị đóng. `lastPersistAt` là dấu thời gian flush nội bộ, không làm room thành dirty sau restart. Cache khởi tạo từ database, so sánh trong hàng đợi ghi và chỉ cập nhật sau commit thành công. Rollback giữ cache cũ để lần ghi lại có thể thử lại đầy đủ.

Transaction/rollback, API/WS contract, commit trước broadcast, luật cờ và timeout giữ nguyên. Không đổi schema, driver hoặc dependency. Instrumentation phục vụ điều tra đã gỡ khỏi runtime sau khi lưu bằng chứng local.

## Kiểm thử

Thêm 6 Node tests cho snapshot không đổi, ghi đúng room, rollback/retry, hai snapshot đồng thời, đóng/mở lại và khởi tạo khi chưa load. Thêm 1 test SQL thật xác minh phiên bản/payload của trận không liên quan giữ nguyên, constraint failure rollback toàn transaction, retry, đóng room và restart. Không thay đổi assertion hoặc timeout của các bài cũ.

Chạy Node/build/kiến trúc và migration như README. Chạy đầy đủ SQL trong database QA riêng:

```powershell
$env:DB_DRIVER = 'sqlcmd'
$env:DB_SERVER = '.\SQLEXPRESS'
$env:DB_DATABASE = 'CoTuongIntegrationTest_QA_20261028'
$env:RUN_SQL_TESTS = 'true'
npm.cmd run test:qa:sql
Remove-Item Env:RUN_SQL_TESTS,Env:DB_SERVER,Env:DB_DATABASE,Env:DB_DRIVER
```

Suite SQL chạy tuần tự vì các test tạo server độc lập trên cùng database. Để kiểm tra các server song song, mỗi server cần database riêng. Khi chọn database QA khác, đặt cả `QA_SQL_TEST_DATABASE` và `DB_DATABASE` cùng tên có prefix `CoTuongIntegrationTest_QA_`; schema phải được khởi tạo bằng `db:setup` trước khi lọc chỉ chạy test gameplay. Guard mặc định vẫn yêu cầu đúng database QA ở trên.

Ứng dụng vẫn yêu cầu một Node process sở hữu mỗi database; đây không phải hỗ trợ multi-worker/cluster. Guard optimistic version của account tiếp tục từ chối stale writer. Không dùng nhiều server cùng database để triển khai.

Kết quả chi tiết, ba lượt chạy độc lập và log trước/sau của phiên sửa nằm trong báo cáo local ignored `artifacts/publish/SQL_FAILURE_INVESTIGATION.md`. Các báo cáo QA/migration cũ giữ nguyên số liệu lịch sử; SMTP đến hộp thư thật, camera/micro vật lý và NAT/TURN vẫn chưa nghiệm thu.
