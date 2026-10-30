# Schema database gốc

File SQL tại đây được bảo toàn từ nhánh `database` (`4bb2b74`), trước đây nằm ở root repository. Đây là tài liệu nguồn để đối chiếu, không phải migration runtime đang dùng.

Bootstrap đang dùng `database/01_schema_phase1.sql` và migration cộng thêm `database/03_integration.sql`, thông qua `npm run db:setup`. Không chạy hai bộ script tạo bảng lên cùng database.
