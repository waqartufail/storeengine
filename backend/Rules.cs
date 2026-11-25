using System.Net.Mail;
using System.Text.RegularExpressions;

static class Rules
{
    public static IResult Bad(string msg) => Results.BadRequest(new { message = msg });

    public static IResult Stale() =>
        Results.Conflict(new { message = "Data changed. Refresh and review before saving." });

    public static IResult Denied(Shop s) =>
        Results.Json(
            new
            {
                message = "Store access: "
                    + (s.Status == "Active" ? "plan expired" : s.Status)
                    + ".",
            },
            statusCode: 403
        );

    public static bool Text(string? s, int max) => !string.IsNullOrWhiteSpace(s) && s.Length <= max;

    public static bool Optional(string? s, int max) => s != null && s.Length <= max;

    public static bool Email(string? s) =>
        Text(s, 254) && MailAddress.TryCreate(s, out var e) && e.Address == s;

    public static bool Password(string? s) =>
        s is { Length: >= 12 and <= 128 } && !string.IsNullOrWhiteSpace(s);

    public static bool Money(decimal n) => n >= 0 && n <= 10000000 && decimal.Round(n, 2) == n;

    public static bool Weight(decimal n) => n > 0 && n <= 10000 && decimal.Round(n, 3) == n;

    public static bool Https(string? s) =>
        Uri.TryCreate(s, UriKind.Absolute, out var u) && u.Scheme == "https" && u.UserInfo == "";

    public static bool Video(string source)
    {
        if (source == "")
            return true;
        if (!source.StartsWith("data:", StringComparison.Ordinal))
            return source.Length <= 8192 && Https(source);
        var sep = source.IndexOf(',');
        if (sep < 0 || source.Length > 11184840)
            return false;
        var type = source[..sep];
        if (type is not ("data:video/mp4;base64" or "data:video/webm;base64"))
            return false;
        try
        {
            var bytes = Convert.FromBase64String(source[(sep + 1)..]);
            if (bytes.Length > 8 * 1024 * 1024)
                return false;
            return type == "data:video/mp4;base64"
                ? bytes.Length >= 12 && bytes.AsSpan(4, 4).SequenceEqual("ftyp"u8)
                : bytes.AsSpan().StartsWith(new byte[] { 0x1a, 0x45, 0xdf, 0xa3 });
        }
        catch (FormatException)
        {
            return false;
        }
    }

    public static bool Image(string? s)
    {
        if (s == "")
            return true;
        if (s == null || s.Length > 1400000)
            return false;
        if (!s.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            return Https(s) && s.Length <= 8192;
        var sep = s.IndexOf(',');
        if (sep < 0)
            return false;
        var kind = s[..sep];
        if (
            kind
            is not ("data:image/png;base64" or "data:image/jpeg;base64" or "data:image/webp;base64")
        )
            return false;
        try
        {
            var data = Convert.FromBase64String(s[(sep + 1)..]);
            return kind switch
            {
                "data:image/png;base64" => data.AsSpan()
                    .StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
                "data:image/jpeg;base64" => data.AsSpan().StartsWith(new byte[] { 255, 216, 255 }),
                _ => data.Length >= 12
                    && data.AsSpan(0, 4).SequenceEqual("RIFF"u8)
                    && data.AsSpan(8, 4).SequenceEqual("WEBP"u8),
            };
        }
        catch (FormatException)
        {
            return false;
        }
    }

    public static readonly string[] Themes =
    [
        "midnight",
        "royal",
        "ocean",
        "emerald",
        "sunset",
        "rose",
        "lavender",
        "minimal",
        "copper",
        "neon",
    ];
    public static readonly string[] Statuses =
    [
        "Pending",
        "Confirmed",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
    ];

    public static bool Config(ShopConfig? c)
    {
        if (
            c?.Shipping is not { } s
            || !Money(s.BaseCharge)
            || !Weight(s.IncludedWeight)
            || !Money(s.ExtraPerKg)
            || c.Couriers is not { Count: > 0 and <= 30 }
            || c.Payments is not { Count: > 0 and <= 20 }
        )
            return false;
        if (
            c.Couriers.Any(x =>
                x == null
                || !Text(x.Name, 64)
                || !Optional(x.PickupCode, 100)
                || !Optional(x.Notes, 500)
                || !Optional(x.ApiUrl, 2048)
                || (x.ApiUrl != "" && !Https(x.ApiUrl))
            )
            || c.Couriers.Select(x => x.Name.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count() != c.Couriers.Count
            || !c.Couriers.Any(x => x.Enabled && x.Name == c.DefaultShipper)
        )
            return false;
        if (
            c.Payments.Any(x =>
                x == null
                || !Text(x.Name, 64)
                || x.Kind is not ("cod" or "online" or "card")
                || !Optional(x.Details, 1500)
                || !Image(x.Qr)
                || !Optional(x.Url, 2048)
                || (x.Url != "" && !Https(x.Url))
                || (x.Enabled && x.Kind == "card" && x.Url == "")
            )
            || !c.Payments.Any(x => x.Enabled)
            || c.Payments.Select(x => x.Name.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count() != c.Payments.Count
        )
            return false;
        return c.WhatsApp != null
            && Optional(c.WhatsApp.BusinessPhone, 50)
            && Optional(c.WhatsApp.PhoneId, 80)
            && Optional(c.WhatsApp.Template, 100);
    }
}
