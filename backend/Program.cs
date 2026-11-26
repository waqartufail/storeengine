using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;
var ownerEmail = cfg["Owner:Email"]?.Trim().ToLowerInvariant();
var ownerPassword = cfg["Owner:Password"];
if (!Rules.Email(ownerEmail) || !Rules.Password(ownerPassword))
    throw new InvalidOperationException(
        "Configure Owner__Email and Owner__Password (12–128 characters)."
    );
builder.Services.AddDbContext<StoreDb>(o =>
    o.UseNpgsql(
        cfg.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Set ConnectionStrings__Default.")
    )
);
var pagesOrigin = cfg["Pages:Origin"]?.TrimEnd('/');
if (!string.IsNullOrWhiteSpace(pagesOrigin))
    builder.Services.AddCors(options =>
        options.AddPolicy(
            "StorefrontPages",
            policy =>
                policy
                    .WithOrigins(pagesOrigin)
                    .WithMethods("GET", "POST")
                    .WithHeaders("Content-Type", "X-NW-Request")
        )
    );
var auth = builder.Services.AddAuthentication();
foreach (var role in new[] { "admin", "owner" })
    auth.AddCookie(
        role,
        o =>
        {
            o.Cookie.Name = "nw." + role;
            o.Cookie.HttpOnly = true;
            o.Cookie.SameSite = SameSiteMode.Strict;
            o.Cookie.SecurePolicy = cfg.GetValue<bool>("Cookies:Secure")
                ? CookieSecurePolicy.Always
                : CookieSecurePolicy.SameAsRequest;
            o.ExpireTimeSpan = TimeSpan.FromHours(8);
            o.SlidingExpiration = false;
        }
    );
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy(
        "auth",
        ctx =>
            RateLimitPartition.GetFixedWindowLimiter(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "local",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 50,
                    Window = TimeSpan.FromMinutes(5),
                }
            )
    );
});
builder
    .Services.AddHttpClient("postex", c => c.Timeout = TimeSpan.FromSeconds(25))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddDataProtection();
builder.Services.AddSingleton<PostExCredentials>();
builder.Services.AddHostedService<PostExWorker>();
var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<StoreDb>();
    await db.Database.EnsureCreatedAsync();
    await db.Database.ExecuteSqlRawAsync(
        await File.ReadAllTextAsync(
            Path.Combine(AppContext.BaseDirectory, "Database", "upgrade.sql")
        )
    );
}
if (!string.IsNullOrWhiteSpace(pagesOrigin))
    app.UseWhen(
        ctx => ctx.Request.Path.StartsWithSegments("/api/stores"),
        branch => branch.UseCors("StorefrontPages")
    );
app.UseRateLimiter();
app.Use(
    async (ctx, next) =>
    {
        ctx.Response.Headers.CacheControl = "no-store";
        if (ctx.Request.Method != "GET" && ctx.Request.Headers["X-NW-Request"] != "portal")
        {
            ctx.Response.StatusCode = 403;
            return;
        }
        await next();
    }
);
app.MapGet("/health", () => new { status = "ok" });
var accounts = app.MapGroup("/api/auth").RequireRateLimiting("auth");
accounts.MapPost(
    "/signup",
    async (Signup req, StoreDb db) =>
    {
        var email = req.Email?.Trim().ToLowerInvariant();
        if (
            !Rules.Email(email)
            || !Rules.Password(req.Password)
            || !Rules.Text(req.Name, 100)
            || !Rules.Text(req.AdminName, 100)
        )
            return Rules.Bad(
                "Enter a store name, admin name, valid email and a 12–128 character password."
            );
        var prefix = Regex.Replace(req.Name.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        var shop = new Shop
        {
            Email = email!,
            AdminName = req.AdminName.Trim(),
            Name = req.Name.Trim(),
            BrowserTitle = req.Name.Trim(),
            Slug =
                (prefix.Length > 0 ? prefix : "store") + "-" + Guid.NewGuid().ToString("N")[..10],
        };
        shop.PasswordHash = new PasswordHasher<Shop>().HashPassword(shop, req.Password);
        db.Shops.Add(shop);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
            when (ex.InnerException is PostgresException { SqlState: "23505" })
        {
            return Results.Conflict(new { message = "This email is already registered." });
        }
        return Results.Json(new { shop.Slug, shop.Status }, statusCode: 201);
    }
);
accounts.MapPost(
    "/{role}/login",
    async (string role, Login req, HttpContext ctx, StoreDb db) =>
    {
        var email = req.Email?.Trim().ToLowerInvariant();
        if (!Rules.Email(email) || req.Password is null || req.Password.Length > 128)
            return Results.Unauthorized();
        List<Claim> claims = [];
        if (role == "owner")
        {
            if (
                email != ownerEmail
                || !CryptographicOperations.FixedTimeEquals(
                    SHA256.HashData(Encoding.UTF8.GetBytes(req.Password)),
                    SHA256.HashData(Encoding.UTF8.GetBytes(ownerPassword!))
                )
            )
                return Results.Unauthorized();
            claims.Add(new("role", role));
        }
        else if (role == "admin")
        {
            var shop = await db.Shops.SingleOrDefaultAsync(s => s.Email == email);
            if (
                shop == null
                || new PasswordHasher<Shop>().VerifyHashedPassword(
                    shop,
                    shop.PasswordHash,
                    req.Password
                ) == PasswordVerificationResult.Failed
            )
                return Results.Unauthorized();
            if (!shop.Available)
                return Rules.Denied(shop);
            claims.Add(new("id", shop.Id.ToString()));
            claims.Add(new("version", shop.SessionVersion.ToString()));
        }
        else
            return Results.NotFound();
        await ctx.SignInAsync(role, new ClaimsPrincipal(new ClaimsIdentity(claims, role)));
        return Results.Ok();
    }
);
app.MapPost(
    "/api/auth/{role}/logout",
    async (string role, HttpContext ctx) =>
    {
        if (role != "admin" && role != "owner")
            return Results.NotFound();
        await ctx.SignOutAsync(role);
        return Results.NoContent();
    }
);
var owner = app.MapGroup("/api/owner")
    .AddEndpointFilter(
        async (ctx, next) =>
            (await ctx.HttpContext.AuthenticateAsync("owner")).Succeeded
                ? await next(ctx)
                : Results.Unauthorized()
    );
owner.MapGet(
    "/stores",
    async (StoreDb db) =>
        (
            await db
                .Shops.AsNoTracking()
                .OrderByDescending(s => s.CreatedAt)
                .Select(s => new
                {
                    s.Id,
                    s.Name,
                    s.Slug,
                    s.Email,
                    s.AdminName,
                    s.Status,
                    s.Plan,
                    s.ExpiresAt,
                    s.CreatedAt,
                })
                .ToListAsync()
        )
);
owner.MapPut(
    "/stores/{id:int}",
    async (int id, Decision req, StoreDb db) =>
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var shop = await db
            .Shops.FromSqlInterpolated($"SELECT * FROM \"Shops\" WHERE \"Id\"={id} FOR UPDATE")
            .SingleOrDefaultAsync();
        if (shop == null)
            return Results.NotFound();
        if (req.Action == "Activate")
        {
            var now = DateTime.UtcNow;
            if (req.Plan is not ("Trial" or "Monthly" or "Yearly" or "Lifetime"))
                return Rules.Bad("Choose a plan.");
            shop.Status = "Active";
            shop.Plan = req.Plan;
            shop.ExpiresAt = req.Plan switch
            {
                "Trial" => now.AddDays(14),
                "Monthly" => now.AddMonths(1),
                "Yearly" => now.AddYears(1),
                _ => null,
            };
        }
        else if (req.Action is "Deactivate" or "Reject")
        {
            shop.Status = req.Action == "Reject" ? "Rejected" : "Inactive";
        }
        else
            return Rules.Bad("Invalid owner action.");
        shop.SessionVersion++;
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Results.Ok();
    }
);
var admin = app.MapGroup("/api/admin")
    .AddEndpointFilter((ctx, next) => Access.Gate(ctx, next, true));
var store = app.MapGroup("/api/stores/{slug}")
    .AddEndpointFilter((ctx, next) => Access.Gate(ctx, next, false));
admin.MapGet("/access", () => Results.NoContent());
app.MapGet(
    "/api/directory",
    async (StoreDb db) =>
        await db
            .Shops.Where(s =>
                s.Status == "Active" && (s.ExpiresAt == null || s.ExpiresAt > DateTime.UtcNow)
            )
            .OrderBy(s => s.Name)
            .Select(s => new { s.Name, s.Slug })
            .ToListAsync()
);
PostExCredentials.Map(admin);
Catalog.Map(admin, store);
Sales.Map(admin, store);
app.Run();

static class Access
{
    public static Shop Shop(HttpContext c) => (Shop)c.Items["shop"]!;

    public static async ValueTask<object?> Gate(
        EndpointFilterInvocationContext f,
        EndpointFilterDelegate next,
        bool admin
    )
    {
        var ctx = f.HttpContext;
        var db = ctx.RequestServices.GetRequiredService<StoreDb>();
        var write = ctx.Request.Method != "GET";
        await using var tx = write ? await db.Database.BeginTransactionAsync() : null;
        Shop? shop;
        if (admin)
        {
            var auth = await ctx.AuthenticateAsync("admin");
            if (!auth.Succeeded || !int.TryParse(auth.Principal?.FindFirstValue("id"), out var id))
                return Results.Unauthorized();
            shop = write
                ? await db
                    .Shops.FromSqlInterpolated(
                        $"SELECT * FROM \"Shops\" WHERE \"Id\"={id} FOR UPDATE"
                    )
                    .SingleOrDefaultAsync()
                : await db.Shops.FindAsync(id);
            if (shop == null || !shop.Available)
                return shop == null ? Results.Unauthorized() : Rules.Denied(shop);
            if (shop.SessionVersion.ToString() != auth.Principal!.FindFirstValue("version"))
                return Results.Unauthorized();
        }
        else
        {
            var slug = ctx.Request.RouteValues["slug"]?.ToString();
            var publicShop = db.Shops.AsNoTracking().Where(s => s.Slug == slug);
            // Revision checks need access state and version, without loading banner and gallery data.
            if (ctx.GetEndpoint()?.Metadata.GetMetadata<CatalogRevision>() != null)
                publicShop = publicShop.Select(s => new Shop
                {
                    Id = s.Id,
                    Status = s.Status,
                    ExpiresAt = s.ExpiresAt,
                    SettingsVersion = s.SettingsVersion,
                });
            shop = write
                ? await db
                    .Shops.FromSqlInterpolated(
                        $"SELECT * FROM \"Shops\" WHERE \"Slug\"={slug} FOR UPDATE"
                    )
                    .SingleOrDefaultAsync()
                : await publicShop.SingleOrDefaultAsync();
            if (shop == null || !shop.Available)
                return Results.NotFound(new { message = "This store is unavailable." });
        }
        ctx.Items["shop"] = shop;
        var result = await next(f);
        if (tx != null && !(result is IStatusCodeHttpResult r && r.StatusCode >= 400))
            await tx.CommitAsync();
        return result;
    }
}
