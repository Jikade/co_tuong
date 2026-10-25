namespace CoTuong.Core.Dtos;

/// <summary>Yeu cau tao Room (README muc 3).</summary>
public sealed record CreateRoomRequest(string TenPhong, string CheDoHienThi);

/// <summary>Yeu cau tham gia Room bang ma (README muc 6.2).</summary>
public sealed record JoinRoomByCodeRequest(string MaPhong);

/// <summary>
/// Anh toan (snapshot) cua mot Room — gong bang "thong tin hien thi nhat" trong
/// man hinh Room. Client luon de thoi diem het han de dem nguoc, khong tin
/// dong ho cua chinh minh.
/// </summary>
public sealed record RoomSnapshot(
    long MaPhong,
    string MaSoPhong,
    string TokenMoi,
    string TenPhong,
    string CheDoHienThi,
    string TrangThai,
    int SoKhanGiaToiDa,
    // Chu Room
    long MaChuPhong,
    string TenHienThiChuPhong,
    bool SanSangChuPhong,
    // Oi thuu (null = trong)
    long? MaDoiThu,
    string? TenHienThiDoiThu,
    bool SanSangDoiThu,
    // Khan gia
    IReadOnlyList<KhanGiaItem> KhanGia,
    // Loi moi truc tiep dang cho (chi hien thi chu room)
    LoiMoiVaoPhongSnapshot? LoiMoiDangCho,
    DateTime ThoiDiemServerUtc);

/// <summary>Mot nhan gia dang trong Room.</summary>
public sealed record KhanGiaItem(
    long MaNguoiDung,
    string TenHienThi,
    string TenDangNhap,
    DateTime ThoiDiemVao);

/// <summary>Trang thai loi moi truc tiep dang cho phan hoi.</summary>
public sealed record LoiMoiVaoPhongSnapshot(
    long MaLoiMoi,
    long MaNguoiDuocMoi,
    string TenHienThiNgudiMoi,
    DateTime ThoiDiemGui,
    DateTime ThoiDiemHetHan,
    string TrangThai);

/// <summary>Mot Room trong danh sach cong khai (README muc 6.1).</summary>
public sealed record RoomCongKhaiItem(
    long MaPhong,
    string TenPhong,
    string TenHienThiChuPhong,
    string TrangThai,
    int SoKhanGia,
    int SoKhanGiaToiDa,
    string CheDoHienThi);

/// <summary>Mot ban be co the duoc moi vao Room (README muc 4).</summary>
public sealed record MoiBanBeItem(
    long MaBanBe,
    string TenHienThi,
    string TenDangNhap,
    bool DangOnline);
