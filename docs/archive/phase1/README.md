# Tài liệu lịch sử Phase 1

Hai tài liệu ở đây được chuyển nguyên nội dung từ source Phase 1, chỉ làm bằng chứng lịch sử:

- [PHASE1_PLAN.md](PHASE1_PLAN.md)
- [PHASE1_ACCEPTANCE.md](PHASE1_ACCEPTANCE.md)

Các đường dẫn code và lệnh .NET trong hai tài liệu mô tả phiên bản cũ tại `archive/phase1-dotnet-original` (`d92474d20a155904274dd93ff87975a325a74580`), không phải hướng dẫn chạy nhánh ứng dụng JavaScript hiện tại. Không dùng kết quả test C# cũ làm bằng chứng cho migration mới.

Source C#/Blazor/SignalR/EF, test, project/config và scaffold đầy đủ nằm trên nhánh archive; không nằm trong nhánh ứng dụng. Xem [FULL_JAVASCRIPT_MIGRATION.md](../../FULL_JAVASCRIPT_MIGRATION.md), [PHASE1_PARITY_MATRIX.md](../../PHASE1_PARITY_MATRIX.md) và [MIGRATION_VALIDATION.md](../../MIGRATION_VALIDATION.md) cho trạng thái hiện tại.

SQL chạy hiện tại nằm trong `database/01_schema_phase1.sql`, `02_seed_du_lieu.sql`, `03_integration.sql`, `04_phase1_compat.sql`. Không cần EF hoặc scaffold .NET để khởi tạo database. Script phá hủy `99_drop_all.sql` chỉ còn trên archive; không sử dụng nó trong migration.
