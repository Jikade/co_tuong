using System.Reflection;
using CoTuong.Core.Errors;
using Xunit;

namespace CoTuong.Tests.Core.Errors;

/// <summary>
/// README quy dinh thong bao loi phai dung va cu the. Moi ma loi phai co
/// dung mot thong diep tieng Viet (khong dung chung mot thong diep chung).
/// </summary>
public class BusinessErrorTests
{
    [Fact]
    public void MoiMaLoi_DuocDinhNgh_MotThongDiep()
    {
        var fields = typeof(BusinessErrorCode)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f.IsLiteral && f.FieldType == typeof(string))
            .ToList();

        Assert.NotEmpty(fields);

        var thongDiep = new Dictionary<string, string>();
        foreach (var field in fields)
        {
            var maLoi = (string)field.GetRawConstantValue()!;

            Assert.False(string.IsNullOrWhiteSpace(maLoi));

            var msg = BusinessErrorMessages.Get(maLoi);
            Assert.False(string.IsNullOrWhiteSpace(msg));
            Assert.NotEqual("Đã xảy ra lỗi. Vui lòng thử lại.", msg);

            // Khong duoc trung thong diep giua hai ma loi khac nhau.
            Assert.False(thongDiep.TryGetValue(msg, out var truocDo) && truocDo == maLoi,
                $"Ma loi '{maLoi}' dung chung thong diep voi '{truocDo}'.");

            thongDiep[msg] = maLoi;
        }
    }

    [Fact]
    public void Get_TraVeThongDiepChung_KhiKhongBietMaLoi()
    {
        Assert.Equal("Đã xảy ra lỗi. Vui lòng thử lại.", BusinessErrorMessages.Get("MA_KHONG_TON_TAI"));
    }

    [Fact]
    public void BusinessException_GiuMaLoiVaThongDiep()
    {
        var ex = new BusinessException(BusinessErrorCode.DaLaBanBe);

        Assert.Equal(BusinessErrorCode.DaLaBanBe, ex.MaLoi);
        Assert.Equal(BusinessErrorMessages.Get(BusinessErrorCode.DaLaBanBe), ex.Message);
    }

    [Fact]
    public void ThongDiepKhongLoThongTinTaiKhoan()
    {
        // README muc 2: "khong tiet lo thong tin nhay cam cua tai khoan".
        var msg = BusinessErrorMessages.Get(BusinessErrorCode.ThongTinDangNhapKhongDung);

        Assert.DoesNotContain("tồn tại", msg, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("không tồn tại", msg, StringComparison.OrdinalIgnoreCase);
    }
}
