# Nghiệm thu Phase 1

Phạm vi đối chiếu: [README.md](README.md) phần Phase 1 và [PHASE1_PLAN.md](PHASE1_PLAN.md), đến hết bước 10. Các tính năng thuộc Phase 2 trở đi không nằm trong nghiệm thu này.

| Yêu cầu | Kết quả | Ghi chú / bằng chứng |
|---|---|---|
| Schema Phase 1, mapping EF, migration và dữ liệu dev | ✅ Đạt | `database/01_schema_phase1.sql`, `02_seed_du_lieu.sql`, migration và model snapshot đã được rà soát. Schema/seed đã chạy lặp trên `CoTuongOnline_Test`; migration EF cũng đã áp dụng tại DB thử nghiệm. Không chạy script trên `CoTuongOnline`. |
| Đăng ký, đăng nhập, phiên, refresh, đăng xuất, quên và đặt lại mật khẩu | ✅ Đạt qua kiểm thử | Integration tests bao phủ idempotency đăng ký (cùng payload trả cùng tài khoản; khác payload bị từ chối), refresh token, rate limit, reset token dùng một lần và thu hồi phiên. HTTP smoke test trước đó xác nhận cookie/Bearer, logout và reset password. |
| Tìm kiếm người dùng, kết bạn, lời mời và thông báo | ✅ Đạt qua kiểm thử | Integration tests bao phủ chấp nhận một lần, hủy lời mời, mời bạn vào Room, người gửi không phải Chủ Room, bạn offline và lời mời hết hạn. |
| Tạo Room, tham gia bằng mã/link, phân vai, quản lý thành viên và chuyển Chủ Room | ✅ Đạt qua kiểm thử | Integration tests bao phủ tạo lặp, mã tham gia, Room đóng, chặn người bị đá, rời Room/chuyển Chủ Room và tự nhận vị trí Đối thủ. HTTP smoke test trước đó xác nhận tạo/join Room. |
| Sẵn sàng và Bắt đầu ở ranh giới Phase 1 | ✅ Đạt qua kiểm thử | Kiểm tra sẵn sàng sai điều kiện, lặp thao tác Bắt đầu, tạo một Match và khởi tạo 32 quân; trạng thái Room chuyển sang `Full`. Countdown 3-2-1, chọn Đỏ/Đen và luật/nước đi thuộc Phase 2, được loại khỏi phạm vi. |
| SignalR: đồng bộ Room, lời mời, presence và heartbeat giữa hai trình duyệt | ◐ Chưa nghiệm thu tương tác | Hub, snapshot, sự kiện và ping đã có trong mã nguồn. Chưa có bằng chứng chạy hai trình duyệt độc lập để xác nhận cập nhật tức thời/online-offline đầu cuối. |
| Đi trọn luồng chỉ bằng UI (đăng ký → tạo/tham gia Room → sẵn sàng → bắt đầu) | ◐ Chưa nghiệm thu tương tác | Các route UI đã trả HTTP 200 trong smoke test; chưa có kiểm thử trình duyệt xác nhận thao tác form, validation tại trường và điều hướng xuyên suốt không cần gọi API thủ công. |
| Build và test suite | ✅ Đạt | `dotnet test CoTuong.slnx --no-restore`: 69 passed, 0 failed, 0 skipped trên bản kiểm tra cô lập `.phase1-validation`. Phát hiện và gỡ cặp file migration trùng khỏi working tree trước khi chốt. |
| Checklist nghiệm thu có đủ 3 cột | ✅ Đạt | Tài liệu này ghi yêu cầu / kết quả / bằng chứng hoặc phần còn thiếu. |

## Việc còn lại để đóng Phase 1

1. Chạy UI end-to-end trên trình duyệt với hai tài khoản: một luồng đăng ký/đăng nhập và tạo Room; tài khoản thứ hai tham gia; kiểm tra trạng thái Sẵn sàng, lời mời, presence và Bắt đầu cập nhật ở cả hai cửa sổ.
2. Chụp lại bằng chứng nghiệm thu cho luồng UI và real-time, rồi đổi hai mục ◐ thành ✅ nếu đạt.

Hai mục trên là kiểm chứng tương tác thật của Phase 1, không yêu cầu triển khai tính năng chơi cờ của Phase 2. Những lỗi được phát hiện trong buổi nghiệm thu cần được sửa trước khi đánh dấu Phase 1 hoàn tất.
