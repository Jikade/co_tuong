# Báo cáo lỗi nghiệm thu — 28/10/2026

Nhánh: `qa/system-acceptance-20261028`, tách từ `integration` tại `a7b9718`. Không sửa `main` hoặc các nhánh nguồn; chưa push.

19 mục đã khắc phục bên dưới gồm lỗi tái hiện bằng test và khoảng thiếu được tìm thấy khi đối chiếu Word/source. Không coi 19 mục là 19 test FAIL độc lập: một số điểm UI được phát hiện từ code/baseline thể hiện hành vi trái kịch bản rồi mới thêm regression test. Kết quả cuối không còn assertion FAIL; SMTP vẫn là chức năng bắt buộc chưa triển khai.

| Mã | Mức | Vấn đề / nguyên nhân | Sửa và bằng chứng sau sửa |
|---|---|---|---|
| QA-001 | P1 | Chủ Room luôn Đỏ, trái yêu cầu phân ngẫu nhiên mỗi Match | Draw một lần bằng crypto RNG, lưu cùng Match. Test quan sát cả hai cách phân bên, fixture kiểm tra từng nhánh, reconnect không đổi màu. `acceptance.test.js`, P2-013. |
| QA-002 | P2 | Client vẽ các ô legal-move dù Word cấm gợi ý | Chỉ giữ highlight quân được chọn; server kiểm tra sau khi chọn đích. Edge chơi được, cả khi đang chiếu không có marker. P2-019/082. Baseline Edge cũ từng assert marker=1, là bằng chứng hành vi cũ trái Word. |
| QA-003 | P1 | Invite bị từ chối khi ô Đối thủ có người; nguy cơ Completed trước khi join thất bại | Cho invite vào xem; serialize thao tác Room và chấp nhận, join thành công mới Complete; phòng đầy giữ invite Pending. `acceptance-before.log`, `acceptance-security.test.js`, P1-098/100/101/102. |
| QA-004 | P1 | Pending của host cũ/Room đã đóng vẫn chặn invite mới | Invalidate theo Room/host/blocked/deadline; thông báo và không cho reuse. `acceptance-invites/lifecycle.test.js`, P1-116/117/118/181. |
| QA-005 | P2 | Người mới tự ngồi ghế trống dù Room đã có spectator | Giữ spectator, chỉ đổi ghế qua opt-in; ready reset. `acceptance-before.log`, `acceptance-completeness.test.js`, P1-143/164. |
| QA-006 | P2 | Frontend chấp nhận password yếu/confirm khác nhau tới lúc gửi API | Native required/email/minlength/pattern và custom validity confirm; backend tiếp tục validate riêng. `browser-before.log`, `frontend-validation.log`, ENV-006. |
| QA-007 | P2 | Link reset giả/đã dùng vẫn hiện form đổi mật khẩu | Public endpoint kiểm tra token có rate limit; chỉ hiển thị form khi token hợp lệ. Edge outbox → reset → login mới, link giả/reuse bị từ chối. P1-023/024/031. |
| QA-008 | P2 | Hủy kết bạn không xác nhận | Thêm xác nhận; cancel giữ quan hệ, accept xóa hai chiều, Match và lịch sử vẫn nguyên. P1-061/063/064/065. |
| QA-009 | P2 | Invite chỉ hiện giờ hết hạn; thiếu tên người mời/Room | Bổ sung metadata, countdown mỗi giây và xóa dòng khi về 0; hai UI đã chờ đủ 60s thực. P1-091/093/094/109/112. |
| QA-010 | P2 | UI bạn bè/public Room có thể cũ; không có lọc nhanh bạn bè | WS gửi tín hiệu invalidate không chứa dữ liệu riêng, refresh có debounce; list hiện host/status và lọc bạn bè. Edge ba người kiểm tra cập nhật không bấm Làm mới. P1-080/129/130/131. |
| QA-011 | P2 | Thiếu camera làm thất bại cả cuộc gọi dù còn mic | Retry audio-only cho lỗi thiết bị phù hợp; từ chối quyền vẫn báo lỗi/cho thử lại. Real local WebRTC với fake tracks đã kết nối, mic/camera toggle và recall hoạt động. `browser-before.log`, P4-027. |
| QA-012 | P1 | Edge offline không nhất thiết đóng TCP/WS cũ | Client đóng WS khi offline, reconnect khi online; server thêm ping/pong heartbeat. Edge Offline/Online thực tế dẫn tới pause/resume, không mất lịch sử. P3-012/015/016. |
| QA-013 | P1 | Hai người disconnect lệch thời điểm bị Voided tại deadline đầu tiên | Chờ riêng từng deadline, người thứ hai còn quyền quay lại; xử lý expired trước resume. `results-before.log`, `acceptance-results.test.js`, P3-024. |
| QA-014 | P1 | Snapshot đang chơi thiếu board được tải mà không báo lỗi | Kiểm tra cấu trúc board/ID/quân/arrays khi restore; fail closed, không tạo bàn chuẩn hoặc ghi đè dữ liệu hỏng. `results-before.log`, P3-020. Cần sửa/khôi phục snapshot hợp lệ để khởi động lại. |
| QA-015 | P2 | Bạn bè chỉ có trong JSON, bảng `ban_be`/view chưa phản ánh quan hệ | Project quan hệ của user integration trong transaction có version guard, giữ lịch sử khi unfriend. SQL thật trước: 0 dòng; sau: 1 quan hệ đúng. `sql-extended-before.log`, DB-002. |
| QA-016 | P2 | Sau QA-001, host Đen bị ghi sai người tạo Match là Đỏ | Lưu `creatorId` độc lập màu, SQL dùng creator thật. Đây là giả định cũ được phát hiện khi kiểm thử thay đổi phân màu, không phải lỗi đã xảy ra ở baseline luôn-host-Đỏ. SQL fixture host Đen xác nhận creator=host. |
| QA-017 | P1 | Quay lại sau reconnect timeout bị ban thay vì xem kết quả | Không biến timeout thành kick ban; giữ Match finished và khóa nước đi. Kick do host vẫn chặn. `expired-return-before.log`, P3-019, result/history không nhân đôi. |
| QA-021 | P2 | Chia Room có thể mở native share mà không có URL/copy link riêng trong UI | Thêm popup URL readonly, Copy link và lựa chọn native riêng; clipboard thật, board không bị dời/co. P1-071/072/120/121. Native share không tự gửi tin ra ngoài. |
| QA-022 | P3 | Thiếu thông báo rõ khi spectator chủ động trở thành Đối thủ | Thêm thông báo theo chuyển vai trò; Edge assert nội dung và ready reset. P1-147. |

## Chưa hoàn thành / cần môi trường thật

| Mã | Mức | Trạng thái | Điều kiện để đóng |
|---|---|---|---|
| QA-018 | P1 | NOT IMPLEMENTED | Runtime hiện chỉ ghi JSON outbox, chưa có SMTP adapter/email chứa URL tới hộp thư thật. Triển khai vận chuyển email, cấu hình môi trường test và xác minh nhận thư/reset qua thư thật. Hai hàng P1-021 và ENV-001 cùng nói về một khoảng thiếu này. |
| QA-019 | P2 | BLOCKED | Chạy bằng camera/micro vật lý và quyền trình duyệt/OS; fake media không thay bằng chứng này. ENV-002. |
| QA-020 | P2 | BLOCKED | Hai mạng độc lập, HTTPS hợp lệ và TURN được cấu hình/kiểm chứng. Hiện client có STUN, chưa có TURN để nghiệm thu. ENV-003. |

Không có lỗi P0 được phát hiện trong phạm vi đã chạy. Không thể xác nhận “không còn P1” vì QA-018 chưa đóng.

## Sửa test để đúng yêu cầu và loại lỗi harness

- Không xóa bài gốc. Hai assertion Edge marker=1 đổi thành selected=1, marker=0 theo Word; nước đi/capture/chat/video/replay vẫn chạy.
- Test cũ giả định host Đỏ được chuyển sang đọc màu thực, hoặc fixture draw=0 khi cần kiểm tra SQL `RedWin` xác định. RNG production có regression riêng cho cả hai cách phân bên.
- Khi có spectator và ghế trống, test rejoin phải chủ động `become-opponent`, theo đúng Word.
- Sửa harness đọc queued event cũ bằng tên phòng tạo riêng/drain trước chuyển ghế; dùng socket mới sau reconnect; chọn nút Tham gia trong đúng dòng Room; chờ mã 6 số và role spectator được server xác nhận; mở panel theo aria-expanded. Các lỗi này không được tính là lỗi sản phẩm.
- Không thay thời gian production. Server Edge QA riêng dùng machine delay 800ms để quan sát “Máy đang đi”; các mốc 3s/60s vẫn kiểm tra thực. Các test rút gọn chỉ dùng options của instance test.

Log trước sửa: `artifacts/qa/acceptance-before.log`, `browser-before.log`, `results-before.log`, `sql-extended-before.log`, `expired-return-before.log`. Trace/screenshot ban đầu: `artifacts/qa/before-browser/`; lỗi selector harness: `artifacts/qa/harness-before-browser/`.

Log sau sửa: `final-node.log`, `sql.log`, `browser.log`, `regression-edge.log`, `build.log` trong `artifacts/qa/`. Ma trận và kết quả máy đọc được: [QA_TEST_MATRIX.md](QA_TEST_MATRIX.md), [qa-results.json](qa-results.json).
