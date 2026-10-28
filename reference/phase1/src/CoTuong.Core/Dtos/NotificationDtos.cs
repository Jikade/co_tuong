namespace CoTuong.Core.Dtos;

public sealed record ThongBaoItem(
    long Ma,
    string Loai,
    long? MaNguoiThucHien,
    string? TenNguoiThucHien,
    long? MaPhong,
    long? MaLoiMoiVaoPhong,
    long? MaLoiMoiKetBan,
    string? DuLieuPhu,
    bool DaDoc,
    DateTime NgayTao,
    DateTime? ThoiDiemHetHanLoiMoi);
