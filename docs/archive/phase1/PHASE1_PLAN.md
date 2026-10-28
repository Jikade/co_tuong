# KẾ HOẠCH THỰC HIỆN PHASE 1 — Tài khoản, Tạo Room, Tham gia Room

> Người thực hiện: Backend/Dev chính của dự án.
> Nền tảng: C# / .NET 10 · Blazor Server (Blazor Web App, render mode Interactive Server) · EF Core + Dapper · SQL Server (`IVANBROSKINAVA` / `CoTuongOnline`).
> Tài liệu nguồn: `README.md` (Kịch bản chức năng Phase 1) + `database/01_schema_phase1.sql` (schema do DB Designer chốt).

---

## 0. Nguyên tắc chỉ đạo (ràng buộc xuyên suốt)

| # | Nguyên tắc | Hệ quả cụ thể |
|---|---|---|
| R1 | **Schema là hợp đồng đã chốt.** Không sửa cột/bảng đã có nếu không thêm vào script `01_schema_phase1.sql` và ghi chú lý do. | Mọi bảng Phase 1 dùng đúng tên/cột sẵn có. |
| R2 | **CHECK/UNIQUE index không thay thế logic.** Mọi luồng nhiều người dùng phải chạy trong transaction + khoá. | `IRoomLock` theo `ma_phong`, `SELECT ... WITH (UPDLOCK, ROWLOCK)`. |
| R3 | **Server là nguồn sự thật.** Client chỉ gửi yêu cầu; không tự quyết vai trò, không tự phân quân, không tự kết luận trạng thái. | Mọi thay đổi trạng thái đi qua Hub → Service → DB → broadcast. |
| R4 | **Thao tác lặp chỉ hiệu lực 1 lần.** | Khoá idempotency client gửi kèm (`Guid`), lưu bảng `dbo.yeu_cau_chong_lap` (bảng mở rộng duy nhất của Phase 1 — xem Mục 1). |
| R5 | **Mọi thông báo lỗi hiển thị đúng ngôn ngữ nghiệp vụ trong README.** | Mã lỗi nghiệp vụ dùng hằng (`BusinessErrorCode`), ánh xạ 1-1 sang thông báo tiếng Việt. |
| R6 | **Phân biệt rõ [DB] / [BACKEND] / [DB + BACKEND].** | Ghi chú đã đọc trong script được chuyển thành checklist trong từng bước. |

---

## 1. Phân tích gap: README (Phase 1) ↔ Schema hiện có

Đã đối chiếu từng yêu cầu Phase 1 với schema. Kết quả:

### 1.1. Yêu cầu đã được schema đáp ứng đủ

| Nhóm | Bảng dùng | Ghi chú |
|---|---|---|
| 1. Đăng ký / 2. Đăng nhập / 2.1 Quên–Đặt lại mật khẩu | `nguoi_dung`, `phien_dang_nhap`, `token_dat_lai_mat_khau`, `yeu_cau_dat_lai_mat_khau` | Đủ, kể cả unique "1 token Active/người dùng" và index rate-limit theo email/IP. |
| 2.2 Kết bạn | `loi_moi_ket_ban`, `ban_be` | Unique filtered index chặn trùng lời mời Pending giữa 2 người; `ban_be` dùng cặp (nho, lon) → 1 dòng = 1 quan hệ 2 chiều. |
| 3. Tạo Room | `phong` | `ma_so_phong` CHAR(6) + unique filtered (chỉ Room chưa Closed), `token_moi` CHAR(32), `so_khan_gia_toi_da` max 10. |
| 4. Mời bạn (60 giây) | `loi_moi_vao_phong`, `thanh_vien_phong`, `ket_noi_nguoi_dung` | `thoi_diem_het_han = gui + 60s`; unique "1 Pending/người mời". |
| 5. Mời bằng link | `phong.token_moi` | Link `/room/join/{token_moi}`. |
| 6. Tham gia Room & vai trò | `thanh_vien_phong`, `su_kien_thanh_vien_phong`, `cam_vao_phong` | Unique filtered: 1 Host, 1 Opponent, 1 dòng/người/room khi còn trong Room. |
| 6.3 Chuyển quyền Chủ Room | `thanh_vien_phong.thoi_diem_vao` (thứ tự ưu tiên Khán giả), `su_kien_thanh_vien_phong` (`HostTransferred`) | Đủ. |
| 7. Sẵn sàng / Bắt đầu | `thanh_vien_phong.san_sang`, `tran_dau`, `usp_khoi_tao_quan_co_tran_dau` | `UX_tran_dau_mot_active_room` chặn tạo 2 Match cùng lúc cho 1 Room. |

### 1.2. Gap cần xử lý (quyết định đã chốt trong kế hoạch này)

| # | Gap | Cách xử lý |
|---|---|---|
| G1 | Schema không có khoá idempotency cho "bấm nhiều lần" (Tạo Room, Bắt đầu, Kết bạn). | **Thêm bảng mở rộng duy nhất**: `dbo.yeu_cau_chong_lap(ma, ma_nguoi_dung, khoa_idempotency UNIQUE, loai, ket_qua_bam, ngay_tao)`. Ghi vào `01_schema_phase1.sql` phần 12. |
| G2 | `thong_bao.loai` chỉ cho phép 7 giá trị (FriendRequest*, RoomInvitation*). Các sự kiện Phase 1 khác (chuyển Chủ Room, Đối thủ đã vào, Bắt đầu) **không** ghi được vào bảng này. | Các sự kiện đó chỉ phát qua SignalR (không lưu bảng). Chỉ 7 loại trong `CK_thong_bao_loai` mới ghi `thong_bao`. Ghi rõ trong code bằng `NotificationWriter` chỉ nhận 7 loại hợp lệ. |
| G3 | Không có cột "Match đã tạo" trên `phong`; trạng thái Room phải suy ra. | Dùng chính `phong.trang_thai`: `WaitingOpponent` → `Full` (đã đủ 2 người, Match đã tạo, chờ countdown) → `InMatch` (Phase 2 bắt đầu). Suy ra "đã có Match" bằng `EXISTS tran_dau WHERE ma_phong = @p AND trang_thai <> 'Finished'`. |
| G4 | `CK_tran_dau_nguoi_choi` bắt buộc `ma_nguoi_tao` là 1 trong 2 người chơi, và PvP bắt buộc có `ma_phong`. | Chỉ Chủ Room được Bất đầu → thỏa. Nếu sau này cho Đối thủ bấm Bắt đầu thì phải nới CHECK (ghi vào backlog Phase 2). |
| G5 | `v_nguoi_dung_online` dùng lease 60 giây; Heartbeat chưa có. | Bắt buộc có client ping mỗi 20 giây + `HostedService` quét dọn session cũ. Thỏa `[BACKEND]` ở mục 2 script. |
| G6 | Gửi email thật chưa có hạ tầng. | `IEmailSender` + 2 hiện thực: `SmtpEmailSender` (cấu hình trong `appsettings`) và `FileEmailSender` (mặc định dev: ghi file vào `emails/` để test luồng đặt lại mật khẩu). |
| G7 | `phong.che_do_hien_thi` = `Private` mà vẫn có `ma_so_phong` — cần quy tắc ai được nhập bằng mã. | Riêng tư = ai có mã/link/lời mời đều vào được (đúng README mục 5/6.2), nhưng **không** xuất hiện trong danh sách công khai. |

### 1.3. Bảng Phase 1 **không** dùng (để Phase sau)

`tran_dau` (chỉ dùng 1 phần để tạo Match), `quan_co_tran_dau`, `nuoc_di_tran_dau`, `de_nghi_hoa`, `mat_ket_noi_tran_dau`, `su_kien_tran_dau`, `tin_nhan_phong`, `cuoc_goi_video`, `nguoi_tham_gia_cuoc_goi`, `giao_dien_ban_co`, `cai_dat_nguoi_dung`, `v_lich_su_tran_dau`, `v_thong_ke_nguoi_dung`.
→ **Giữ nguyên trong DB, không map entity, không viết logic.** Nhưng vẫn cần `quan_co_tran_dau` ở bước Start (khởi tạo 32 quân qua `usp_khoi_tao_quan_co_tran_dau`).

---

## 2. Kiến trúc dự án

```
co_tuong/
├── PHASE1_PLAN.md                  <- file này
├── README.md                       <- kịch bản chức năng (không sửa)
├── database/
│   ├── 01_schema_phase1.sql        <- schema DB đã chốt (script tạo mới)
│   ├── 02_seed_du_lieu.sql         <- dữ liệu dev (tài khoản test, sẵn sàng)
│   └── 99_drop_all.sql             <- xoá sạch để dựng lại từ đầu
├── CoTuong.sln
├── src/
│   ├── CoTuong.Core/               <- Domain + Application (không phụ thuộc hạ tầng)
│   │   ├── Entities/               <- POCO map 1-1 bảng DB
│   │   ├── Enums/                  <- hằng trạng thái (string trong DB)
│   │   ├── Abstractions/            <- IEmailSender, IPasswordHasher, IClock, IUnitOfWork...
│   │   ├── Services/                <- Service nghiệp vụ (dùng chung cho Blazor & API)
│   │   ├── Dtos/                    <- Request/Response models
│   │   ├── Validation/              <- quy tắc mật khẩu, tên Room, mã Room, email
│   │   └── Errors/                  <- BusinessException + mã lỗi
│   ├── CoTuong.Infrastructure/     <- EF Core, migrations, Dapper, email, DI extensions
│   ├── CoTuong.Web/                <- Blazor Web App (UI + SignalR Hub + API)
│   └── CoTuong.Tests/              <- xUnit (Unit + Integration)
```

**Quy ước ánh xạ DB → C#**

| DB | C# | Ghi chú |
|---|---|---|
| `ma` | `Ma` | Khớp tên cột (chữ thường → PascalCase) để dễ đối chiếu schema ↔ code. |
| `ten_dang_nhap` | `TenDangNhap` | |
| `vai_tro` | `VaiTro` | Kiểu string + hằng `VaiTro.Host/Opponent/Spectator` (DB lưu chuỗi, không lưu enum số). |
| `trang_thai` | `TrangThai` | Tương tự — dùng `const string` để không lệch với CHECK constraint. |
| `datetime2(3)` UTC | `DateTime` | **Quy ước bắt buộc: mọi `DateTime` lưu trong DB là UTC.** Cấu hình Npgsql/SqlClient không tự đổi; dùng `DateTimeKind.Utc` khi đọc (`GetValue` trả `Unspecified` → ép `DateTime.SpecifyKind`). Dùng `IClock` thay vì `DateTime.UtcNow` để test được. |

**Entity nào map trong Phase 1 (13 bảng):**
`NguoiDung`, `PhienDangNhap`, `TokenDatLaiMatKhau`, `YeuCauDatLaiMatKhau`, `KetNoiNguoiDung`, `LoiMoiKetBan`, `BanBe`, `Phong`, `ThanhVienPhong`, `SuKienThanhVienPhong`, `CamVaoPhong`, `LoiMoiVaoPhong`, `ThongBao` + bảng mở rộng `YeuCauChongLap`.

---

## 3. Bước thực hiện (10 bước, thứ tự phụ thuộc)

Ước lượng: 1 người full-time ≈ **5.5–6.5 tuần** (20 ngày làm việc).

---

### Bước 0 — Nền tảng & công cụ (0.5 ngày)

| Hạng mục | Nội dung |
|---|---|
| Công cụ | .NET SDK 10.0.401 ✔ có sẵn · SQL Server client `sqlcmd` ✔ · cài `dotnet-ef` 10 (`dotnet tool install --global dotnet-ef --version 10.*`) |
| Solution | `dotnet new sln` + 4 project: `blazor` (→ `CoTuong.Web`), `classlib` ×3, `xunit` |
| Target | `net10.0` · Nullable enable · ImplicitUsings enable |
| Cấu hình chung | `.editorconfig`, `Directory.Build.props` (TreatWarningsAsErrors), `Directory.Packages.props` (Central Package Management) |
| Cổng chạy | `http://localhost:5080` (HTTPS 7080) |
| **Xong khi** | `dotnet build` sạch, `dotnet run` mở được trang mặc định |

**Checkpoint cần bạn xác nhận:** .NET 10 mới có template `blazor` (Blazor Web App). Nếu máy CI khác version → khoá `net10.0` ở `global.json`.

---

### Bước 1 — Dựng schema & khung EF Core (1 ngày)

| Hạng mục | Nội dung |
|---|---|
| DB | Chạy `database/01_schema_phase1.sql` lên `CoTuongOnline` (user tự chạy — policy chặn agent ghi DB dùng chung). Thêm mục 12: bảng `dbo.yeu_cau_chong_lap` (G1). |
| Scaffold | `dotnet ef dbcontext scaffold "Server=IVANBROSKINAVA;Database=CoTuongOnline;..." CoTuong.Infrastructure --context CoTuongDbContext --namespace Entities --use-database-names` → sinh entity + DbContext khớp **chính xác** schema. Sau đó: đổi namespace, thêm `OnModelCreating` chỉ định `ToTable/HasColumnName/HasKey`, thêm `UseSnakeCaseNamingConvention` (package `EFCore.NamingConventions`). |
| Baseline | **Không** tạo migration đầu tiên — schema đã tồn tại. Đánh dấu baseline bằng `dotnet ef migrations add Baseline --empty` + `MigrationsAssembly` cấu hình, để migration sau chỉ chứa phần thêm. |
| Bổ sung | Bảng mở rộng `yeu_cau_chong_lap` → tạo **migration thật** (`AddYeucauChongLap`) để có lịch sử thay đổi. |
| Cấu hình | `appsettings.json` + `appsettings.Development.json` (ConnectionString dạng `LocalDB`/`IVANBROSKINAVA`); dùng **User Secrets** cho biến nhạy cảm. |
| Kiểm thử | Script `99_drop_all.sql` + `01_schema_phase1.sql` → dựng lại DB sạch từ đầu, đảm bảo chạy 2 lần không lỗi. |

**Điểm cần chú ý:** `char(6)`/`char(32)` trong C# → dùng `string` kèm `.Trim()` khi so sánh (SQL `CHAR` trả về khoảng trắng đệm). `ma_so_phong` kiểm tra format bằng regex `^\d{6}$` ở tầng validation, không dựa vào `LIKE` của SQL.

**Xong khi:** `dotnet ef database update` chạy trên DB rỗng tạo ra đúng schema; `DbContext` map 13 bảng; đọc/ghi `nguoi_dung` thành công.

---

### Bước 2 — Core layer: Enum, DTO, Validation, Errors (1 ngày)

| Hạng mục | Nội dung |
|---|---|
| Enums/hằng | `VaiTro`, `TrangThaiPhong`, `TrangThaiLoiMoiKetBan`, `TrangThaiLoiMoiVaoPhong`, `TrangThaiThongBao`, `CheDoHienThi`, `LoaiSuKienThanhVien` — tất cả là `const string` khớp CHECK constraint. |
| Validation | `PasswordPolicy` (≥8 ký tự, có chữ **và** số) · `EmailValidator` (dùng `System.Net.Mail.MailAddress` + chặn domain rác) · `TenDangNhapValidator` (3–50, ký tự chữ/số/`_`/`.`) · `TenPhongValidator` (1–100) · `MaPhongValidator` (`^\d{6}$`) |
| Errors | `BusinessError` (mã + thông điệp tiếng Việt): `TEN_DANG_NHAP_DA_TON_TAI`, `EMAIL_DA_TON_TAI`, `SAI_MAT_KHAU`, `TAI_KHOAN_KHONG_HOAT_DONG`, `TOKEN_KHONG_HIEU_LUC`, `KHONG_TON_TAI_PHONG`, `PHONG_DA_DAY`, `O_DOI_THU`, `KHONG_PHAI_CHU_ROOM`, `DA_BI_DA_KHOI_PHONG`, `KHONG_DU_QUYEN`, `ROOM_DA_CO_MATCH`, … |
| Abstractions | `IClock` (UTC), `IPasswordHasher` (PBKDF2), `IEmailSender`, `IRoomLockProvider`, `IIdempotencyStore`, `IRealtimeNotifier` (SignalR abstraction để Core không phụ thuộc Hub) |
| DTO | `RegisterRequest`, `LoginRequest`, `ResetPasswordRequest`, `CreateRoomRequest`, `JoinRoomRequest`, `InviteFriendRequest`, `RoomSnapshot`, `FriendListItem`, `NotificationItem`… |

**Xong khi:** validation + error codes viết xong, có unit test cho `PasswordPolicy` và `MaPhongValidator`.

---

### Bước 3 — Xác thực: Đăng ký / Đăng nhập / Phiên / Đăng xuất / Quên–Đặt lại mật khẩu (2 ngày)

Ánh xạ README mục 1, 2, 2.1:

| Hành vi | Cơ chế |
|---|---|
| 1. Đăng ký | `POST /api/auth/register` + form Blazor. Validate tất cả → lỗi hiển thị **ngay tại ô nhập**. Insert `nguoi_dung` (hash mật khẩu, `dang_hoat_dong=1`, `thoi_diem_doi_mat_khau=now`). Bắt `UX_nguoi_dung_ten_dang_nhap` / `UX_nguoi_dung_email` → trả lỗi "đã tồn tại" tương ứng. Bấm nhiều lần → dùng khoá idempotency + unique index. **Không** tự đăng nhập; chuyển sang màn hình Đăng nhập. |
| 2. Đăng nhập | `POST /api/auth/login`: tra `nguoi_dung` theo `ten_dang_nhap`, verify hash, kiểm tra `dang_hoat_dong`. Sai thông tin → thông báo chung ("Tên đăng nhập hoặc mật khẩu không đúng"), **không** tiết lộ tài khoản có tồn tại. Cập nhật `lan_dang_nhap_cuoi`. |
| 2. Duy trì phiên | Cookie auth (Blazor Server) + **JWT access/refresh** cho API: access token 15 phút, refresh token 30 ngày lưu bảng `phien_dang_nhap` (chỉ lưu hash). `POST /api/auth/refresh` xoay vòng refresh token (thu hồi cũ, cấp mới). Cookie hết hạn → `OnExpired` gọi refresh. |
| 2. Đăng xuất | `thoi_diem_thu_hoi` được set trên `phien_dang_nhap` → mọi màn hình yêu cầu tài khoản trả 401/redirect về Login. |
| 2. Deep-link Room | Login hỗ trợ `returnUrl` → sau khi đăng nhập quay lại đúng Room. Kiểm tra Room còn hợp lệ trước khi chuyển hướng. |
| 2.1 Quên mật khẩu | `POST /api/auth/forgot-password`: luôn trả **thông báo chung** ("Nếu email này được đăng ký…"). Nếu email tồn tại & active → tạo token random 32 byte, lưu **hash** vào `token_dat_lai_mat_khau` (`trang_thai='Active'`, hạn 15 phút), vô hiệu các token Active cũ của tài khoản (`thoi_diem_thu_hoi` set → chuyển `Revoked`; hoặc `UPDATE` trạng thái) rồi gửi email link `/reset-password?token=...`. Ghi `yeu_cau_dat_lai_mat_khau` (kể cả khi email không tồn tại) để rate-limit. **Rate limit**: tối đa 3 lần/giờ theo email và 10 lần/giờ theo IP. |
| 2.1 Đặt lại mật khẩu | `GET /reset-password?token=` → kiểm tra token tồn tại, `trang_thai='Active'`, chưa hết hạn → hiện form Mật khẩu mới / Xác nhận. `POST` → validate policy + khớp 2 ô → đổi `mat_khau_bam`, set `thoi_diem_doi_mat_khau`, token → `trang_thai='Used'`, `thoi_diem_su_dung=now`. Token dùng lần 2 → "Liên kết đặt lại mật khẩu không còn hiệu lực". |

**Mật khẩu:** dùng `Microsoft.AspNetCore.Identity.PasswordHasher<T>` (PBKDF2, có sẵn, không cần package) — định dạng hash lưu vừa `NVARCHAR(255)`. Không dùng MD5/SHA1.

**Màn hình:** `Register`, `Login`, `ForgotPassword`, `ResetPassword`, `Logout`, layout không hiện menu khi chưa đăng nhập.

**Xong khi:** đăng ký → đăng nhập → reload trang vẫn giữ phiên → đăng xuất → mọi màn hình chặn → quên/đặt lại mật khẩu chạy trọn vòng; token dùng lần 2 bị từ chối.

---

### Bước 4 — Danh bạ & Kết bạn (1.5 ngày)

Ánh xạ README mục 2.2:

| Hành vi | Cơ chế |
|---|---|
| Tìm kiếm | `GET /api/nguoi-dung/tim-kiem?q=` — tìm theo `ten_dang_nhap` **hoặc** `ten_hien_thi` (`IX_nguoi_dung_hien_thi_ten` có sẵn). Luôn loại chính mình khỏi kết quả. Trả kèm trạng thái quan hệ: `BanBe` / `ChoPhep` / `KhongCo`. |
| Gửi lời mời | `POST /api/ban-be/loi-moi`. Kiểm tra: tồn tại, không phải bản thân, chưa là bạn bè, chưa có Pending. Insert `loi_moi_ket_ban` (`Pending`) + `thong_bao` loại `FriendRequestReceived` + push SignalR. **Bắt `UX_loi_moi_kb_mot_dang_cho_moi_cap` → lỗi "đã có lời mời đang chờ".** |
| A mời B, B mời A đồng thời | Trước khi insert, tra Pending ngược chiều. Nếu có → **hiểu là Chấp nhận**: tạo `ban_be`, chuyển lời mời cũ → `Accepted`, thông báo `FriendRequestAccepted` cho A. Nếu insert bị unique violation (race) → bắt lỗi, đọc lại và xử lý theo nhánh "chấp nhận". **Chỉ 1 lời mời Pending cho mỗi cặp.** |
| Danh sách lời mời | `GET /api/ban-be/loi-moi` (của người nhận): tên hiển thị + tên đăng nhập người gửi. |
| Chấp nhận / Từ chối | `POST /api/ban-be/loi-moi/{ma}/chap-nhan` / `tu-choi`. **Chỉ xử lý 1 lần**: `UPDATE ... WHERE ma=@id AND trang_thai='Pending'` → nếu rowcount=0 trả "lời mời không còn hiệu lực". Chấp nhận → insert `ban_be` (cặp nho/lon) + thông báo `FriendRequestAccepted`; Từ chối → `Rejected` + `FriendRequestRejected`. |
| Hủy lời mời | `POST /api/ban-be/loi-moi/{ma}/huy` (người gửi) → `Cancelled`; biến mất khỏi danh sách chờ của người nhận. Người nhận bấm Chấp nhận lời mời đã hủy → "không còn hiệu lực". |
| Danh sách bạn bè | `GET /api/ban-be` — dùng view `v_danh_sach_ban_be` (đã 2 chiều) + `v_nguoi_dung_online` để lấy Online/Offline. Hiển thị: tên hiển thị, tên đăng nhập, trạng thái. |
| Hủy kết bạn | `POST /api/ban-be/huy` → có hộp thoại xác nhận ở UI → `DELETE ban_be` (1 dòng = cả 2 phía). Không ảnh hưởng Match đang chạy, không ảnh hưởng vai trò trong Room. |

**Xong khi:** mời/duyệt/từ chối/hủy/hủy bạn đúng trạng thái; trường hợp mời chéo chỉ còn 1 lời mời; bấm Chấp nhận 2 lần chỉ xử lý 1 lần.

---

### Bước 5 — Phòng: tạo, xem danh sách, tham gia, vai trò, quản lý thành viên (2.5 ngày)

Ánh xạ README mục 3, 5, 6.1, 6.2, 6.3:

| Hành vi | Cơ chế |
|---|---|
| Tạo Room | `POST /api/phong`: validate tên Room → tạo `ma_so_phong` random 6 số (thử lại khi trùng unique filtered) + `token_moi` random 32 hex → insert `phong` (`che_do_hien_thi`, `trang_thai='WaitingOpponent'`, `so_khan_gia_toi_da=10`) → insert `thanh_vien_phong` vai trò `Host` (`nguon_tham_gia='Create'`) + `su_kien_thanh_vien_phong` (`RoomCreated`). Bấm nhiều lần → khoá idempotency (G1). |
| Màn hình Room | Hiển thị: tên Room, mã Room, link mời (`/room/join/{token_moi}`), thông tin Chủ Room, ô Đối thủ, danh sách Khán giả (≤10), nút Sao chép mã / Sao chép link. |
| Danh sách Room công khai | `GET /api/phong/cong-khai` dùng view `v_phong_cong_khai` (tên Room, tên Chủ Room, trạng thái, số khán giả). Chỉ `che_do_hien_thi='Public'` và `trang_thai<>'Closed'`. Cập nhật trạng thái tức thời qua SignalR (bước 8). |
| Tham gia bằng mã | `POST /api/phong/tham-gia/ma` — validate `^\d{6}$` → tra Room đang hoạt động. Không thấy → "Không tìm thấy Room"; đã đóng → "Room không còn khả dụng". Bấm nhiều lần → 1 lần (idempotency + unique index). |
| Tham gia bằng link | `GET /room/join/{token}` → nếu chưa đăng nhập → Login với `returnUrl` → quay lại đúng Room. Room hết hạn → "Room không còn tồn tại hoặc không còn khả dụng". |
| Xác định vai trò | Trong **1 transaction** (khoá `ma_phong`): đếm khán giả hiện tại vs `so_khan_gia_toi_da` → nếu đủ → từ chối "Room hiện đã đầy". Nếu ô Đối thủ trống **và** chưa có Khán giả nào → vào với vai trò `Opponent`; ngược lại vào với vai trò `Spectator`. **Không** tự động kéo Khán giả lên làm Đối thủ. |
| Chủ Room loại khỏi vị trí Đối thủ | `POST /api/phong/{ma}/doi-vai-tro/bo-doi-thu` → Đối thủ → `Spectator`, ô Đối thủ trống, **xoá trạng thái Sẵn sàng** của người đó. Ghi `su_kien_thanh_vien_phong` (`RemovedFromOpponent`). |
| Khán giả chủ động vào ô Đối thủ | `POST /api/phong/{ma}/vao-vai-tro-doi-thu` → kiểm tra ô Đối thủ còn trống, người đó vẫn trong Room, chưa có Match. Tranh chấp → unique filtered index `UX_tv_phong_mot_doi_thu` bảo vệ; người thua nhận "Vị trí đã có người" và vẫn là Khán giả. |
| Chủ Room đá khỏi Room | `POST /api/phong/{ma}/dang-xuat` → set `thoi_diem_roi` + `ly_do_roi='Kicked'`, insert `cam_vao_phong` (bị chặn vào lại Room này), ghi `su_kien` (`Kicked`). **Không** cho vào lại bằng danh sách công khai / mã Room / link — mọi đường vào đều tra `cam_vao_phong`. Khi Room đóng → quyền chặn hết hiệu lực. |
| Chủ Room rời Room (chủ động, trước trận) | Không đóng Room nếu còn người. Thứ tự ưu tiên chuyển quyền: **Đối thủ hiện tại → Khán giả vào sớm nhất → Khán giả thứ 2 → …** (theo `thoi_diem_vao`). Người mới: vai trò `Host`, `san_sang=0`; ô Đối thủ trở lại Trống nếu người nhận là Đối thủ. **Reset Sẵn sàng toàn Room.** Ghi `su_kien` (`HostTransferred`). Thông báo cho mọi người trong Room. |
| Room không còn ai | Đóng Room: `trang_thai='Closed'`, `thoi_diem_dong=now` → mã/link hết hiệu lực. |
| Rời Room (Đối thủ/Khán giả) | `ly_do_roi='Left'`, ô Đối thủ trở lại Trống, xoá Sẵn sàng. Không đóng Room. |
| Tổng khán giả | Vượt `so_khan_gia_toi_da` → từ chối. |

**Khoá tranh chấp (R2):** `IRoomLockProvider` — `SemaphoreSlim` theo `ma_phong` (dictionary + `ConcurrentDictionary`), mọi thao tác Room nhận khoá này. Ghi chú schema: `Index chi gioi han Host/Opponent va mot thanh vien/Room; khong the CHECK COUNT(*) <= so_khan_gia_toi_da` → **phải** đếm trong transaction đó.

**Xong khi:** tạo/join/đổi vai trò/đá/chuyển quyền đúng quy tắc; 2 người bấm cùng lúc chỉ 1 thắng ô Đối thủ; người bị đá không vào lại được bằng mã/link.

---

### Bước 6 — Lời mời trực tiếp vào Room (60 giây) (1.5 ngày)

Ánh xạ README mục 4:

| Hành vi | Cơ chế |
|---|---|
| Mời bạn | `POST /api/phong/{ma}/loi-moi`. Chỉ Chủ Room. Kiểm tra (đúng thứ tự README): ① Chủ Room còn trong Room ② Room còn hoạt động ③ 2 người **vẫn là bạn bè** ④ người nhận **đang Online** (tra `v_nguoi_dung_online`, lease 60s) ⑤ chưa có lời mời Pending khác của Chủ Room. Không đạt → thông báo đúng câu trong README ("Người chơi hiện đang Offline", "cần cập nhật danh sách Bạn bè"). Đạt → insert `loi_moi_vao_phong` (`thoi_diem_het_han = now + 60s`) + `thong_bao` `RoomInvitationReceived` + push SignalR. **Lời mời KHÔNG khoá ô Đối thủ** (Room vẫn hoạt động bình thường). |
| Bộ đếm 60s | Client đếm ngược từ `thoi_diem_het_han` (server cung cấp thời điểm hết hạn — **không** tin đồng hồ client). Cả Chủ Room và người được mời đều thấy. |
| Người được mời chọn Tham gia | `POST /api/phong/loi-moi/{ma}/chap-nhan`. Kiểm tra lại: còn hạn, `trang_thai='Pending'`, Room còn tồn tại, người nhậm **không** bị chặn (`cam_vao_phong`), Room chưa vượt giới hạn khán giả, ô Đối thủ còn trống **và** Match chưa bắt đầu → vào với vai trò `Opponent`; ô Đối thủ đã có người → vào với vai trò `Spectator`; Match đã bắt đầu → chỉ `Spectator`; đã đủ khán giả → "Room hiện đã đầy". Thành công → `trang_thai='Completed'`, dừng bộ đếm. |
| Từ chối | `POST .../tu-choi` → `trang_thai='Declined'`, Chủ Room nhận "Người chơi đã từ chối lời mời". Không đổi trạng thái Room / ô Đối thủ. Chủ Room có thể mời người khác ngay. |
| Hết 60 giây | `HostedService` quét mỗi 5s → `trang_thai='Expired'`, xoá "Đang chờ phản hồi" khỏi màn hình Chủ Room, gửi `thong_bao` `RoomInvitationExpired`. Người được mời không dùng lại được. |
| Hủy lời mời | Chủ Room `POST .../huy` → `Cancelled` + thông báo `RoomInvitationCancelled`; người được mời mất quyền dùng. |
| Vô hiệu hoá tự động | ① Room đóng → `Invalidated` ② Chủ Room đổi/đi → `Invalidated` (mọi lời mời Pending do Chủ Room cũ tạo) ③ Người được mời bị đá → lời mời cũ không vượt được quyền chặn. |
| Ràng buộc | "Một Chủ Room chỉ có một lời mời đang chờ" → `UX_loi_moi_phong_mot_dang_cho_moi_nguoi_moi` (lưu ý: index này khoá theo **người mời**, nên nghiệp vụ "1 lời mời/chủ room" cần **kiểm tra thêm trong transaction** vì index không bảo đảm điều đó → ghi rõ trong code). |

**Xong khi:** đủ 6 nhánh (Tham gia / Từ chối / Hết hạn / Hủy / Vô hiệu hoá / Chủ Room đổi) chạy đúng; lời mời không khoá ô Đối thủ; lời mời hết hạn không dùng lại được.

---

### Bước 7 — Sẵn sàng & Bắt đầu (1 ngày)

Ánh xạ README mục 7:

| Hành vi | Cơ chế |
|---|---|
| Bật nút Sẵn sàng | Chỉ khi Room có đủ Host + Opponent và **chưa** có Match. |
| Bấm Sẵn sàng | `POST /api/phong/{ma}/san-sang` → `UPDATE thanh_vien_phong SET san_sang=1, thoi_diem_san_sang=now` + `su_kien` (`ReadyChanged`) + push cho cả hai. Bỏ Sẵn sàng → `san_sang=0`. |
| Điều kiện Bắt đầu | Chỉ Chủ Room được Bất đầu **và** Host.luôn Sẵn sàng **và** Opponent.luôn Sẵn sàng **và** Match chưa tồn tại. |
| Bấm Bắt đầu nhiều lần | 1 transaction: khoá Room → kiểm tra lại điều kiện → tạo `tran_dau` (`loai_tran='PvP'`, `ma_phong`, `ma_nguoi_choi_do/den` = Host/Opponent, `ma_nguoi_tao` = Host, `trang_thai='Countdown'`) → gọi `usp_khoi_tao_quan_co_tran_dau` → `phong.trang_thai='Full'`. Unique index `UX_tran_dau_mot_active_room` là lớp bảo vệ cuối. Idempotency (G1) chặn double-click. **Sẵn sàng của người cũ không được kế thừa** — người mới thành Đối thủ phải tự bấm Sẵn sàng. |
| Reset Sẵn sàng | Khi Đối thủ rời/bị loại khỏi vị trí → xoá Sẵn sàng của họ. Khi chuyển quyền Chủ Room → reset toàn bộ Room. |
| Khoá 2 vị trí người chơi | Sau khi có Match, Khán giả không thể thay thế Host/Opponent (unique filtered + `tran_dau.ma_phong`). |

**Ranh giới Phase 1 / Phase 2 (quan trọng):** Phase 1 **chỉ** tạo bản ghi Match (`Countdown`) + khởi tạo 32 quân + chuyển Room sang `Full`. **Countdown 3-2-1, phân bên Đỏ/Đen, đồng hồ lượt, nước đi thuộc Phase 2** — không làm trong bước này. `tran_dau` được tạo với `ben_den_luot` mặc định `Red` theo default của schema; Phase 2 sẽ phân bên ngẫu nhiên.

**Xong khi:** Bắt đầu tạo đúng 1 Match, 32 quân, Room = `Full`; bấm 2 lần chỉ có 1 Match; Sẵn sàng sai thời điểm bị từ chối.

---

### Bước 8 — SignalR real-time & trạng thái Online (1.5 ngày)

| Hạng mục | Nội dung |
|---|---|
| Hub | `RoomHub` (`/hubs/room`) + `NotificationHub` (gộp vào 1 hub cho gọn). Group theo `ma_phong` (`room-{maPhong}`) và group cá nhân (`user-{maNguoiDung}`). |
| Client → Server | `SanSang(maPhong)`, `BatDau(maPhong, idempotencyKey)`, `RoiRoom(maPhong)`, `MoVaiTroDoiThu(maPhong)`, `LoaiDoiThu(maPhong)`, `DangXuat(maPhong)`, `GuiLoiMoi(maPhong, maBanBe)`, `ChapNhanLoiMoi(maPhong, maLoiMoi)`, `TuChoiLoiMoi`, `HuyLoiMoi`, `Ping`. |
| Server → Client | `RoomStateChanged` (snapshot đầy đủ: tên, mã, link, trạng thái, Host, Opponent, danh sách Khán giả, trạng thái Sẵn sàng, lời mời đang chờ, đồng hồ đếm ngược), `MemberJoined`, `MemberLeft`, `RoleChanged`, `HostTransferred`, `ReadyChanged`, `InviteReceived`, `InviteUpdated`, `MatchStarted`, `NotificationReceived`, `PublicRoomsChanged`. |
| Snapshot | Luôn gửi **snapshot đầy đủ** thay vì bản delta → tránh lệch trạng thái giữa client. |
| Presence | `OnConnectedAsync` → insert `ket_noi_nguoi_dung` (ConnectionId, heartbeat = now). Client `Ping` mỗi 20s → cập nhật `lan_thay_cuoi`. `OnDisconnectedAsync` → set `thoi_diem_ngat_ket_noi`. Bảng hỗ trợ nhiều tab (1 người = nhiều connection). |
| Lease online | View `v_nguoi_dung_online` dùng lease 60s → heartbeat 20s là an toàn. Phải chốt cùng Backend (ghi chú `[DB + BACKEND]` mục 2 script). |
| Dọn dẹp | `HostedService` quét mỗi 60s: xoá `ket_noi_nguoi_dung` cũ hơn 1 giờ, đánh dấu `thoi_diem_het_han` của `phien_dang_nhap`/`token_dat_lai_mat_khau` đã quá hạn (`Expired`), huỷ lời mời quá hạn. |
| Danh sách công khai | Khi Room tạo/đóng/đổi trạng thái → broadcast `PublicRoomsChanged` cho nhóm `public-rooms`; client tải lại danh sách (đơn giản, chịu được tần suất thấp). |
| Bảo mật Hub | Mọi method kiểm tra `Context.User` + vai trò hiện tại trong DB; **không** tin dữ liệu client gửi lên. |

**Xong khi:** 2 browser thấy trạng thái Sẵn sàng, vai trò, lời mời, đồng hồ 60s cập nhật tức thì; Online/Offline đúng; bấm Sẵn sàng ở tab B hiện ngay ở tab A.

---

### Bước 9 — UI hoàn thiện & trải nghiệm (1.5 ngày)

| Màn hình | Nội dung bắt buộc |
|---|---|
| `Account/Register` | 5 trường, lỗi hiển thị **tại ô nhập**, nút bị khoá khi đang gửi, thông báo thành công → chuyển Login. |
| `Account/Login` | Sai thông tin → thông báo chung; `returnUrl` cho deep-link Room. |
| `Account/ForgotPassword` / `ResetPassword` | Thông báo chung; đếm ngược 15 phút hiển thị; 2 ô mật khẩu mới khớp. |
| Trang chính | Tạo Room · Tham gia bằng mã · Danh sách Room công khai · Bạn bè · Thông báo (badge đếm chưa đọc) · Đăng xuất. |
| `Rooms/Public` | Tên Room, tên Chủ Room, trạng thái, số khán giả; nút Tham gia. Cập nhật tức thì. |
| `Room/{ma}` | Ô Chủ Room, ô Đối thủ, danh sách Khán giả (≤10), nút Sẵn sàng, Bắt đầu (Chủ Room), Mời bạn, Chia sẻ link, Sao chép mã/link, menu Chủ Room (Loại khỏi vị trí Đối thủ, Đá khỏi Room). |
| `Friends` | Danh sách bạn (tên hiển thị, tên đăng nhập, Online/Offline), ô tìm kiếm, tab Lời mời (Chấp nhận/Từ chối), nút Hủy kết bạn (có xác nhận). |
| Hộp thoại mời | Bảng chọn bạn (chỉ bạn bè), nút Mời bị disable với người Offline kèm lý do; cột hiển thị thời gian còn lại. |
| Thông báo | Danh sách thông báo trong game (chỉ 7 loại hợp lệ), đánh dấu đã đọc. |
| Về mặt kỹ thuật | Dùng `EditForm` + `DataAnnotationsValidator` + `ValidationMessageStore` để lỗi về đúng ô · Component dùng `EventCallback` + `InvokeAsync(StateHasChanged)` · Tiếng Việt có dấu đầy đủ (`_layout.cshtml` khai báo `lang="vi"`, file `.razor` lưu UTF-8 BOM) |

**Xong khi:** đi hết 1 luồng nghiệp vụ từ README mục 1 → 7 chỉ dùng UI, không cần gọi API tay.

---

### Bước 10 — Kiểm thử & dữ liệu mẫu (1.5 ngày)

| Hạng mục | Nội dung |
|---|---|
| Test DB | `CoTuongOnline_Test` trên cùng server; `99_drop_all.sql` + `01_schema_phase1.sql` + `02_seed_du_lieu.sql` chạy tự động trước mỗi lần test. |
| Unit test | `PasswordPolicy`, `MaPhongValidator`, `TenPhongValidator`, `EmailValidator` · `PhongCodeGenerator` (6 số, phân bố đều, không trùng) · `TokenGenerator` · ánh xạ mã lỗi → thông điệp. |
| Integration test | Đăng ký trùng lời mời trùng · đăng nhập sai/đúng · quên–đặt lại mật khẩu (dùng `FileEmailSender` để đọc token) · kết bạn & kịch bản mời chéo A↔B · tạo/join Room & tranh chấp ô Đối thủ · đá khỏi Room & thử vào lại bằng mã/link · lời mời 60s (mô phỏng bằng `IClock` giả) · Bắt đầu 2 lần → 1 Match · chuyển quyền Chủ Room theo đúng thứ tự ưu tiên. |
| Công cụ | `IClock` giả để test được mốc 60s/15 phút mà không chờ thật. |
| Seed | `02_seed_du_lieu.sql`: 6 tài khoản test (mật khẩu `Test@1234`), 2 nhóm bạn bè, 1–2 Room mẫu có người, vài lời mời. Hash mật khẩu sinh bằng `PasswordHasher` (chạy 1 lần bằng tool nhỏ để lấy hash, rồi đóng vào SQL). |
| Checklist nghiệm thu | Duyệt lại từng gạch đầu dòng của README Phase 1 và tick ✅/❌ kèm ảnh chụp. |

**Xong khi:** test suite xanh; checklist nghiệm thu Phase 1 có đủ 3 cột (yêu cầu / kết quả / ghi chú).

---

## 4. Bảng trạng thái nghiệp vụ (nguồn chân lý cho code)

| Thực thể | Trạng thái | Nguồn |
|---|---|---|
| `phong.trang_thai` | `WaitingOpponent` → `Full` → `InMatch` → `WaitingNewMatch` → `Closed` | CK_phong_trang_thai |
| `thanh_vien_phong.vai_tro` | `Host` / `Opponent` / `Spectator` | CK_tv_phong_vai_tro |
| `loi_moi_ket_ban.trang_thai` | `Pending` / `Accepted` / `Rejected` / `Cancelled` | CK_loi_moi_kb_trang_thai |
| `loi_moi_vao_phong.trang_thai` | `Pending` / `Completed` / `Declined` / `Expired` / `Cancelled` / `Invalidated` | CK_loi_moi_phong_trang_thai |
| `tran_dau.trang_thai` | `Countdown` / `InProgress` / `PausedReconnect` / `Finished` | CK_tran_dau_trang_thai |
| `token_dat_lai_mat_khau.trang_thai` | `Active` / `Used` / `Expired` / `Revoked` | CK_token_dat_lai_trang_thai |
| `thong_bao.loai` | 7 giá trị (chỉ ghi được 7 loại này — xem G2) | CK_thong_bao_loai |

---

## 5. Ma trận README ↔ hành vi ↔ nơi hiện thực

| README | Hành vi | Bước | Nơi hiện thực (dự kiến) |
|---|---|---|---|
| 1 | Đăng ký tài khoản | 3 | `AuthService.RegisterAsync`, `Account/Register.razor` |
| 2 | Đăng nhập, duy trì phiên, đăng xuất, deep-link | 3 | `AuthService`, `Account/Login.razor`, `AccountController` |
| 2.1 | Quên / đặt lại mật khẩu, rate-limit, token 1 lần | 3 | `AuthService.ForgotPasswordAsync/ResetPasswordAsync`, `FileEmailSender`/`SmtpEmailSender` |
| 2.2 | Tìm kiếm, mời, duyệt, hủy, hủy bạn, trường hợp mời chéo | 4 | `FriendService`, `Friends.razor` |
| 3 | Tạo Room, mã 6 số, link mời, Public/Private | 5 | `RoomService.CreateAsync`, `Rooms/Create.razor` |
| 4 | Mời bạn 60s (đủ 6 nhánh) | 6 | `RoomService.InviteAsync/RespondAsync`, `InviteExpiryHostedService` |
| 5 | Mời bằng link / mạng xã hội | 5 | `RoomHub` group, `Rooms/JoinByToken.razor` |
| 6.1 | Tham gia Room công khai, xác định vai trò, ô Đối thủ, Chủ Room quản lý Đối thủ | 5 | `RoomService.JoinAsync/PromoteToOpponentAsync` |
| 6.2 | Tham gia bằng mã Room | 5 | `RoomService.JoinByCodeAsync` |
| 6.3 | Chuyển quyền Chủ Room theo thứ tự ưu tiên, reset Sẵn sàng | 5 | `RoomService.LeaveAsync/TransferHostAsync` |
| 7 | Sẵn sàng, Bắt đầu, rời Room trước trận, không kế thừa Sẵn sàng | 7 | `RoomService.SetReadyAsync/StartMatchAsync` |
| — | Real-time, Online/Offline | 8 | `RoomHub`, `ConnectionTrackingService` |

---

## 6. Rủi ro & biện pháp

| # | Rủi ro | Mức | Biện pháp |
|---|---|---|---|
| R1 | Quyền DB không cho agent ghi → script schema chưa được apply | Cao | Bạn tự chạy `sqlcmd` (lệnh đã đưa ở đầu). Bước 1 phụ thuộc việc này. |
| R2 | `dbcontext scaffold` sinh entity khớp tên cột tiếng Việt không đẹp → lệch chuẩn code | Trung bình | Chấp nhận entity theo tên cột DB (dễ đối chiếu schema) — quy ước đã ghi ở Mục 2; dùng `partial class` + `[NotMapped]` helper nếu cần thuật tiện. |
| R3 | Blazor Server + SignalR Hub tùy biến: 2 lớp SignalR trong 1 app | Trung bình | Hub tùy biến dùng `/hubs/room`, circuit Blazor dùng đường dẫn riêng — không xung đột. Kiểm tra sớm ở Bước 8 (rủi ro phát hiện muộn). |
| R4 | `thanh_vien_phong` giữ lịch sử (mỗi lần vào = 1 dòng) → bảng phình to theo thời gian | Trung bình | Index đã có sẵn (`thoi_diem_roi IS NULL` filter). Cân nhắc job dọn bản ghi cũ > 90 ngày ở Phase 4. |
| R5 | Race condition ô Đối thủ khi nhiều người bấm đồng thời | Cao | Đã xử lý 2 lớp: khoá `IRoomLockProvider` theo Room + unique filtered index `UX_tv_phong_mot_doi_thu`. Bắt `DbUpdateException` → trả "Vị trí đã có người". |
| R6 | Cấu hình `AIRules` chưa có nguồn email thật | Trung bình | `FileEmailSender` mặc định cho dev; `SmtpEmailSender` chỉ cần điền `appsettings`. |
| R7 | Mất kết nối mạng giữa lúc thao tác → người dùng không biết đã thành công hay chưa | Trung bình | Client gửi khoá idempotency; retry cùng khoá → trả lại kết quả cũ, không tạo trùng. |
| R8 | `DateTime` lẫn giờ local/UTC | Cao | Bắt buộc `IClock` trả UTC; `DateTime.SpecifyKind(..., Utc)` khi đọc; test có case hợp lệ giờ UTC. |

---

## 7. Ngoài phạm vi Phase 1 (để phase sau không phải sửa lại)

| Hạng mục | Lý do hoãn |
|---|---|
| Countdown 3-2-1, phân bên Đỏ/Đen, đồng hồ lượt, nước đi, luật cờ | Phase 2 (README mục PHASE 2) |
| Xử lý mất kết nối 60s, kết quả trận, lịch sử, xem lại | Phase 3 |
| Chat riêng, Video Call, chơi với máy | Phase 4 |
| Elo / bảng xếp hạng / quản trị viên / khoá tài khoản / nhiều độ khó máy | Đã loại khỏi schema |

---

## 8. Thứ tự chạy thực tế (checklist ngắn)

```powershell
# 0) Chuẩn bị DB (BẠN tự chạy - policy chặn agent ghi DB dùng chung)
sqlcmd -S IVANBROSKINAVA -E -C -d CoTuongOnline -i .\database\01_schema_phase1.sql -b

# 1) Scaffolding
dotnet ef dbcontext scaffold "Server=IVANBROSKINAVA;Database=CoTuongOnline;Trusted_Connection=True;TrustServerCertificate=True" `
    CoTuong.Infrastructure --context CoTuongDbContext --namespace Entities --use-database-names

# 2) Chạy app
dotnet run --project src/CoTuong.Web
```

| Bước | Ước lượng | Kết quả mong đợi |
|---|---|---|
| 0. Nền tảng | 0.5 ngày | Solution build sạch |
| 1. Schema + EF | 1 ngày | `CoTuongDbContext` map 13 bảng, migration cho bảng mở rộng |
| 2. Core | 1 ngày | Validation + error codes + abstractions |
| 3. Auth | 2 ngày | Đăng ký / đăng nhập / phiên / đăng xuất / quên–đặt lại mật khẩu |
| 4. Bạn bè | 1.5 ngày | Tìm kiếm, mời, duyệt, hủy, hủy bạn |
| 5. Phòng | 2.5 ngày | Tạo, mã, link, vào, vai trò, đá, chuyển quyền Chủ Room |
| 6. Lời mời 60s | 1.5 ngày | Đủ 6 nhánh vòng đời lời mời |
| 7. Sẵn sàng & Bắt đầu | 1 ngày | 1 Match, 32 quân, Room = Full |
| 8. Real-time | 1.5 ngày | SignalR + Online/Offline |
| 9. UI | 1.5 ngày | Hoàn thiện màn hình theo README |
| 10. Test | 1.5 ngày | Test suite + checklist nghiệm thu |
| **Tổng** | **~15.5 ngày** | **Phase 1 hoàn tất** |
