# Checklist nghiệm thu thủ công còn lại

Ngày: 28/10/2026. Các mục này chưa được thay bằng PASS từ fake media/outbox. Đối chiếu [ma trận](QA_TEST_MATRIX.md), [báo cáo](QA_FINAL_REPORT.md) và [lỗi](QA_BUG_REPORT.md).

## M-01 — Email giao thật (QA-018, P1-021, ENV-001)

Trạng thái hiện tại: **BLOCKED cho hộp thư thật**. SMTP JavaScript đã triển khai và test bằng server local có STARTTLS/TLS/auth/retry; cần cấu hình credentials/môi trường và email nhận thực tế để chạy checklist này. Xem [FULL_JAVASCRIPT_MIGRATION.md](FULL_JAVASCRIPT_MIGRATION.md); `npm.cmd run mail:verify` chỉ kiểm tra kết nối/TLS/auth, chưa chứng minh inbox delivery.

1. Tạo hai tài khoản test có hộp thư nhận được kiểm soát, A/B, không dùng tài khoản người chơi thật.
2. Quên mật khẩu A; kiểm tra phản hồi chung như email không tồn tại. Kiểm tra A nhận thư chứa đúng link, B không nhận nhầm; kiểm tra trạng thái gửi/lỗi vận chuyển.
3. Mở link trong browser chưa đăng nhập; reset đúng tài khoản, mật khẩu cũ ngừng hoạt động, phiên cũ vô hiệu, mật khẩu mới đăng nhập được.
4. Thử link cũ/đã dùng/giả/hết hạn và nhiều yêu cầu liên tiếp; xác nhận token mới nhất, one-use, thời hạn và rate limit.
5. Ghi timestamp nhận thư, môi trường SMTP, test account alias đã che phù hợp và screenshot kết quả. Không coi JSON outbox là bằng chứng giao thư.

Điều kiện PASS: thư thật đến đúng hộp thư, token/link/rate limit đúng, không lộ account existence và không đổi nhầm tài khoản. Chạy lại Node/auth/SQL và Edge reset sau khi thêm adapter.

## M-02 — Camera/micro vật lý (QA-019, ENV-002)

Trạng thái hiện tại: **BLOCKED**. Automation đã dùng `--use-fake-device-for-media-stream`/`--use-fake-ui-for-media-stream`; giả lập lỗi getUserMedia chỉ chứng minh xử lý lỗi của ứng dụng.

1. Mở ứng dụng bằng trình duyệt bình thường, không dùng fake media flags. Dùng localhost hoặc HTTPS hợp lệ; hai phiên/tài khoản độc lập, hai camera/micro thật phù hợp.
2. Chấp nhận quyền, xác nhận hình và âm thanh hai chiều; ghi tên thiết bị, OS/browser và quyền đang dùng.
3. Từ chối camera/mic, cấp lại, thiết bị bận, không có camera nhưng còn mic; xác nhận thông báo rõ và có thể gọi lại.
4. Bật/tắt mic/camera; reject/cancel/hangup; đóng Room khi gọi; rời/mất vai trò. Kiểm tra camera indicator tắt và không còn âm thanh sau khi kết thúc.
5. Trong lúc gọi thực hiện nước cờ, theo dõi clock/turn; reload hoặc offline rồi reconnect, kiểm tra Match không mất dữ liệu.
6. Lưu screenshot/clip kiểm chứng có sự đồng ý của người tham gia và kết quả từng bước.

Điều kiện PASS: thiết bị thật, quyền native và stream thực đều hoạt động đúng; không ảnh hưởng game. Chạy lại WebRTC fake regression sau mọi sửa lỗi media.

## M-03 — Hai mạng độc lập/NAT/TURN (QA-020, ENV-003)

Trạng thái hiện tại: **BLOCKED**. Client hiện chỉ cấu hình STUN. Cần bổ sung cấu hình TURN phù hợp và có hai đường mạng độc lập để kiểm chứng; không chỉ thêm một biến môi trường chưa được code hỗ trợ.

1. Dùng môi trường HTTPS test có chứng chỉ hợp lệ, backend/WS truy cập được từ hai mạng (ví dụ Wi-Fi và 4G/5G).
2. Đăng nhập A/B ở hai thiết bị/mạng khác nhau. Gọi accept/reject/recall; kiểm tra hình/tiếng và Match chạy đồng thời.
3. Kiểm chứng ICE candidate pair thực sự được chọn; chạy thêm lượt buộc relay bằng cấu hình test để chứng minh TURN, phân biệt với host hoặc srflx candidates.
4. Tạm ngắt mạng từng bên, đổi mạng, quay lại trong và sau reconnect window; giữ đúng Match ID/board/capture/turn/clock/result. Chạy trường hợp hai bên mất mạng lệch thời điểm.
5. End call/leave/kick trước trận/close Room; kiểm tra media dừng và người ngoài không nhận signaling/private chat.
6. Lưu môi trường mạng, candidate type, timestamp, log đã loại secrets và kết quả. Test local cùng máy không đóng được mục này.

Điều kiện PASS: direct/relay theo điều kiện test đều có bằng chứng, không phụ thuộc việc hai context cùng máy kết nối được.

## Kiểm tra bổ sung trước vận hành rộng

Các kiểm tra local bắt buộc đã có assertion; các mục dưới là phạm vi triển khai ngoài lượt local này:

- Dùng shared/native share sheet trên OS/thiết bị đích và thao tác sao chép bằng tay. Nút URL/Copy link trong ứng dụng đã được kiểm chứng bằng clipboard thật; native sheet không tự gửi trong automation.
- Xác nhận SQL driver dùng khi triển khai: lượt này là `sqlcmd`/Windows Authentication; nếu dùng `mssql`/SQL login cần chạy lại SQL suite với credentials môi trường test.
- Soak/load và tài nguyên dài hạn trên hạ tầng mục tiêu; lượt này có 40 join/leave và 12 reconnect transport, không chứng minh nhiều giờ hoặc nhiều worker. Không chạy nhiều process ghi cùng database theo thiết kế hiện tại.
- Khi sửa/vận hành snapshot hỏng, khôi phục dữ liệu hợp lệ trước restart; không thay snapshot bằng board chuẩn để tiếp tục Match cũ.

Chỉ đổi kết luận nghiệm thu sau khi cập nhật bằng chứng/trạng thái trong ma trận và chạy regression sau các thay đổi liên quan.
