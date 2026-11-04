# Tham khảo Phase 4

`sql-server-persistence.js` và `phase4_runtime_bridge.sql` là adapter hai bảng bridge cũ của Phase 4, không được chọn bởi runtime. Các regression test gốc ở `test/persistence.test.js` vẫn chạy trực tiếp trên adapter này (pool retry/close failure); không bỏ test sau khi lưu trữ adapter.

Adapter hiện hành là `src/server/persistence/integration-sql-persistence.js`, được chọn tại factory persistence và kiểm thử riêng với SQL Server thật. Không tự chạy script bridge cũ lên database integration.
