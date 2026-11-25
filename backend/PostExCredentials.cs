using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;

sealed class PostExCredentials(IDataProtectionProvider protection, IConfiguration config)
{
    IDataProtector Protector(Shop shop) =>
        protection.CreateProtector("NaturWala.PostEx.Token", shop.Id.ToString());

    string? External(Shop shop)
    {
        var env = config[$"PostEx:Stores:{shop.Id}:Token"];
        if (!string.IsNullOrWhiteSpace(env))
            return env.Trim();
        var dir = config["PostEx:SecretDirectory"];
        if (string.IsNullOrWhiteSpace(dir))
            return null;
        var key = Convert
            .ToHexString(
                SHA256.HashData(Encoding.UTF8.GetBytes(shop.Email.Trim().ToLowerInvariant()))
            )
            .ToLowerInvariant();
        var file = new FileInfo(Path.Combine(dir, key + ".token"));
        if (!file.Exists || file.Length > 8192)
            return null;
        var contents = File.ReadAllText(file.FullName).Trim();
        return Valid(contents) ? contents : null;
    }

    public bool Configured(Shop shop) => shop.PostExSecret.Length > 0 || External(shop) != null;

    public string? Get(Shop shop) =>
        shop.PostExSecret.Length > 0
            ? Protector(shop).Unprotect(shop.PostExSecret)
            : External(shop);

    public static bool Valid(string? token) =>
        token is { Length: > 0 and <= 4096 } && token.All(c => c > 32 && c < 127);

    public void Set(Shop shop, string token) => shop.PostExSecret = Protector(shop).Protect(token);

    public static void Map(RouteGroupBuilder admin)
    {
        admin.MapPut(
            "/couriers/postex/token",
            async (TokenInput body, HttpContext ctx, StoreDb db, PostExCredentials credentials) =>
            {
                var token = body.Token?.Trim();
                if (!Valid(token))
                    return Rules.Bad("Enter a PostEx token without spaces or line breaks.");
                var shop = Access.Shop(ctx);
                credentials.Set(shop, token!);
                await db.SaveChangesAsync();
                return Results.Ok(new { configured = true });
            }
        );
    }
}

record TokenInput(string? Token);
