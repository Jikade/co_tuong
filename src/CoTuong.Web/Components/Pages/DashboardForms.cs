using System.ComponentModel.DataAnnotations;

namespace CoTuong.Web.Components.Pages;

public sealed class CreateRoomForm
{
    [Required(ErrorMessage = "Vui lòng nhập tên Room.")]
    [StringLength(100, ErrorMessage = "Tên Room tối đa 100 ký tự.")]
    public string TenPhong { get; set; } = string.Empty;

    public string CheDoHienThi { get; set; } = "Public";
}

public sealed class JoinRoomForm
{
    [Required(ErrorMessage = "Vui lòng nhập mã Room.")]
    [RegularExpression("^[0-9]{6}$", ErrorMessage = "Mã Room phải gồm đúng 6 chữ số.")]
    public string MaPhong { get; set; } = string.Empty;
}
