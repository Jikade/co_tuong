# Nguồn tham chiếu Phase 1

Các project C# và tài liệu tại đây lấy từ `origin/feature/son_phase1` (`e75b122`), giữ để đối chiếu nghiệp vụ, DTO, validation và EF mapping. Runtime tích hợp ở thư mục gốc dùng Node.js, không chạy backend phòng/SignalR này song song.

Bảng tương đương chức năng, phần đã thay cơ chế và giới hạn SMTP/EF/SignalR: [SOURCE_AUDIT.md](../../docs/SOURCE_AUDIT.md). Không đưa các project này vào build/deployment JavaScript.

Đợt safe-cleanup chỉ bỏ hai trang demo SDK `Counter.razor` và `Weather.razor` (route `/counter`, `/weather`), không có nghiệp vụ cờ tướng. Mã nghiệp vụ C#, test, EF migrations, cấu hình và SMTP vẫn được giữ để đối chiếu; chưa chứng minh tương đương hoàn toàn các contract cũ nên không xóa cả solution. Bản đầy đủ trước dọn nằm tại commit `d92474d` / nhánh `backup/safe-cleanup-d92474d`; kết quả dọn và kiểm thử tại [CODE_AUDIT_REPORT.md](../../docs/CODE_AUDIT_REPORT.md).

`database/99_drop_all.sql` là script phá hủy từ nguồn gốc, chỉ lưu tham chiếu; không dùng trong cài đặt hoặc kiểm thử integration. Schema cài đặt an toàn được mô tả trong README gốc dự án.
