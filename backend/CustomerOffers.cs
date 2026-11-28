using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

static class CustomerOffers
{
    internal static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    static async Task<object> Summary(StoreDb db, int shop, int id)
    {
        var stats = await db.StarReviews.Where(x => x.ShopId == shop && x.ProductId == id).GroupBy(x => 1)
            .Select(g => new { count = g.Count(), average = g.Average(x => x.Stars) }).SingleOrDefaultAsync();
        return new { count = stats?.count ?? 0, average = Math.Round(stats?.average ?? 0, 1, MidpointRounding.AwayFromZero) };
    }
    public static void Map(RouteGroupBuilder admin, RouteGroupBuilder store)
    {
        store.MapGet("/products/{id:int}/rating", async (int id, HttpContext ctx, StoreDb db) =>
        {
            var shop = Access.Shop(ctx).Id;
            if (!await db.Products.AnyAsync(x => x.ShopId == shop && x.Id == id && x.IsActive)) return Results.NotFound();
            return Results.Ok(await Summary(db, shop, id));
        });
        store.MapPost("/products/{id:int}/rating", async (int id, RatingInput input, HttpContext ctx, StoreDb db) =>
        {
            var shop = Access.Shop(ctx).Id;
            if (input.Stars is < 1 or > 5 || !Guid.TryParseExact(input.Voter, "D", out _)) return Rules.Bad("Choose one to five stars.");
            if (!await db.Products.AnyAsync(x => x.ShopId == shop && x.Id == id && x.IsActive)) return Results.NotFound();
            var voter = Hash(input.Voter);
            var row = await db.StarReviews.FindAsync(shop, id, voter);
            if (row == null) db.StarReviews.Add(new() { ShopId = shop, ProductId = id, Voter = voter, Stars = input.Stars });
            else row.Stars = input.Stars;
            await db.SaveChangesAsync();
            return Results.Ok(await Summary(db, shop, id));
        });
        admin.MapPut("/newsletter-rule", async (RuleEdit input, HttpContext ctx, StoreDb db) =>
        {
            var s = Access.Shop(ctx); var rule = input.Rule;
            if (s.SettingsVersion != input.Version) return Rules.Stale();
            if (rule == null || rule.Percent is < 1 or > 100 || !Rules.Money(rule.Minimum) || rule.GoogleClientId == null ||
              (rule.GoogleOnly && rule.GoogleClientId.Length == 0) || (rule.GoogleClientId.Length > 0 &&
              !Regex.IsMatch(rule.GoogleClientId, @"^[a-zA-Z0-9-]{1,220}\.apps\.googleusercontent\.com$"))) return Rules.Bad("Check percentage, minimum subtotal and Google web client ID.");
            var config = ShopConfig.Read(s); config.Newsletter = rule; s.ConfigJson = ShopConfig.Serialize(config); s.SettingsVersion++;
            await db.SaveChangesAsync(); return Results.Ok(new { version = s.SettingsVersion });
        });
        admin.MapGet("/subscribers", async (HttpContext ctx, StoreDb db) => await db.Subscribers.Where(x => x.ShopId == Access.Shop(ctx).Id).OrderByDescending(x => x.Joined).Select(x => new { x.Email, x.Joined, x.Used }).ToListAsync());
        store.MapPost("/newsletter", async (SignupOffer input, HttpContext ctx, StoreDb db) =>
        {
            var s = Access.Shop(ctx); var rule = ShopConfig.Read(s).Newsletter;
            if (rule?.Enabled != true || !input.Consent) return Rules.Bad("Newsletter consent and an active offer are required.");
            var email = input.Email?.Trim().ToLowerInvariant();
            var verified = false;
            if (!string.IsNullOrEmpty(input.Credential))
            {
                if (rule.GoogleClientId.Length == 0 || input.Credential.Length > 8192) return Rules.Bad("Google sign-in unavailable.");
                try
                {
                    var identity = await GoogleJsonWebSignature.ValidateAsync(input.Credential, new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { rule.GoogleClientId } });
                    if (!identity.EmailVerified) return Rules.Bad("Google email verification is required.");
                    email = identity.Email?.Trim().ToLowerInvariant(); verified = true;
                }
                catch (InvalidJwtException) { return Rules.Bad("Google sign-in could not be verified."); }
                catch (HttpRequestException) { return Results.StatusCode(503); }
            }
            if ((rule.GoogleOnly && !verified) || email == null || !Rules.Email(email)) return Rules.Bad("Enter a valid email or use the required Google sign-in.");
            var sub = await db.Subscribers.FindAsync(s.Id, email);
            if (sub != null && (!verified || sub.Used)) return Rules.Bad("A welcome offer is unavailable for this address.");
            var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            if (sub == null) { sub = new() { ShopId = s.Id, Email = email }; db.Subscribers.Add(sub); }
            sub.CodeHash = Hash(code); await db.SaveChangesAsync(); return Results.Ok(new { code });
        });
    }
}
