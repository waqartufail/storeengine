using Microsoft.EntityFrameworkCore;

static class Catalog
{
    static object Brand(Shop s) =>
        new
        {
            s.Name,
            s.BrowserTitle,
            s.Logo,
            s.Banner,
            s.PromoVideo,
            socialLinks = System.Text.Json.JsonSerializer.Deserialize<SocialLink[]>(
                s.SocialLinksJson
            ),
            s.Theme,
            s.Slug,
        };

    public static void Map(RouteGroupBuilder admin, RouteGroupBuilder store)
    {
        admin.MapGet(
            "/settings",
            (HttpContext ctx, PostExCredentials credentials) =>
            {
                var s = Access.Shop(ctx);
                return new
                {
                    brand = Brand(s),
                    postExConfigured = credentials.Configured(s),
                    config = ShopConfig.Read(s),
                    version = s.SettingsVersion,
                    s.Id,
                    s.Plan,
                    s.ExpiresAt,
                };
            }
        );
        admin.MapPut(
            "/brand",
            async (Branding input, HttpContext ctx, StoreDb db) =>
            {
                var s = Access.Shop(ctx);
                if (s.SettingsVersion != input.Version)
                    return Rules.Stale();
                if (
                    !Rules.Text(input.Name, 100)
                    || !Rules.Text(input.BrowserTitle, 120)
                    || !Rules.Image(input.Logo)
                    || !Rules.Image(input.Banner)
                    || !Rules.Themes.Contains(input.Theme)
                )
                    return Rules.Bad("Check the store name, title, images and theme.");
                if (input.PromoVideo != null && !Rules.Video(input.PromoVideo))
                    return Rules.Bad(
                        "Use a public HTTPS video URL or upload an MP4 or WebM up to 8 MiB."
                    );
                if (input.SocialLinks != null)
                {
                    if (
                        input.SocialLinks.Length > 12
                        || input.SocialLinks.Any(x =>
                            x == null
                            || !Rules.Text(x.Label, 48)
                            || !Rules.Text(x.Url, 2048)
                            || !Rules.Https(x.Url)
                        )
                    )
                        return Rules.Bad(
                            "Enter a name and a public HTTPS URL for each social link (maximum 12)."
                        );
                    s.SocialLinksJson = System.Text.Json.JsonSerializer.Serialize(
                        input.SocialLinks
                    );
                }
                if (input.PromoVideo != null)
                    s.PromoVideo = input.PromoVideo;
                s.Name = input.Name.Trim();
                s.BrowserTitle = input.BrowserTitle.Trim();
                s.Logo = input.Logo;
                s.Banner = input.Banner;
                s.Theme = input.Theme;
                s.SettingsVersion++;
                await db.SaveChangesAsync();
                return Results.Ok(new { version = s.SettingsVersion });
            }
        );
        admin.MapPut(
            "/settings",
            async (ConfigEdit input, HttpContext ctx, StoreDb db) =>
            {
                var s = Access.Shop(ctx);
                if (s.SettingsVersion != input.Version)
                    return Rules.Stale();
                if (!Rules.Config(input.Config))
                    return Rules.Bad(
                        "Check rates, unique names, image formats and enabled methods. Enable the default courier and supply an HTTPS link for card payments."
                    );
                s.ConfigJson = ShopConfig.Serialize(input.Config);
                s.SettingsVersion++;
                await db.SaveChangesAsync();
                return Results.Ok(new { version = s.SettingsVersion });
            }
        );
        admin.MapGet(
            "/products",
            async (HttpContext ctx, StoreDb db) => await Products(ctx, db).ToListAsync()
        );
        store.MapGet(
            "",
            async (HttpContext ctx, StoreDb db) =>
            {
                var s = Access.Shop(ctx);
                var config = ShopConfig.Read(s);
                return new
                {
                    brand = Brand(s),
                    config.Shipping,
                    payments = config.Payments.Where(p => p.Enabled),
                    products = await Products(ctx, db).ToListAsync(),
                };
            }
        );
        admin.MapPost(
            "/products",
            (ProductInput input, HttpContext ctx, StoreDb db) => Save(null, input, ctx, db)
        );
        admin.MapPut(
            "/products/{id:int}",
            (int id, ProductInput input, HttpContext ctx, StoreDb db) => Save(id, input, ctx, db)
        );
        admin.MapDelete(
            "/products/{id:int}",
            async (int id, long version, HttpContext ctx, StoreDb db) =>
            {
                var p = await Products(ctx, db).SingleOrDefaultAsync(p => p.Id == id);
                if (p == null)
                    return Results.NotFound();
                if (version != p.Version)
                    return Rules.Stale();
                p.IsActive = false;
                p.Version++;
                await db.SaveChangesAsync();
                return Results.NoContent();
            }
        );
    }

    static IQueryable<Product> Products(HttpContext ctx, StoreDb db)
    {
        var id = Access.Shop(ctx).Id;
        return db
            .Products.Where(p => p.ShopId == id && p.IsActive)
            .OrderBy(p => p.Name)
            .ThenBy(p => p.Id);
    }

    static async Task<IResult> Save(int? id, ProductInput input, HttpContext ctx, StoreDb db)
    {
        if (
            input.Details?.Length > 16000
            || input.Gallery?.Length > 8
            || input.Gallery?.Any(image => string.IsNullOrWhiteSpace(image) || !Rules.Image(image))
                == true
        )
            return Rules.Bad(
                "Use up to eight valid gallery photos and up to 16,000 characters of product details."
            );
        if (
            !Rules.Text(input.Name, 160)
            || !Rules.Text(input.Category, 100)
            || !Rules.Optional(input.Description, 2400)
            || input.Price <= 0
            || !Rules.Money(input.Price)
            || input.Stock is < 0 or > 1000000
            || !Rules.Weight(input.WeightKg)
            || !Rules.Money(input.ShippingCharge)
            || !Rules.Image(input.ImageUrl)
            || !Rules.Optional(input.PromoLabel, 100)
            || !Rules.Money(input.PromoValue)
            || input.PromoKind is not ("None" or "Fixed" or "Percent")
            || (
                input.PromoKind == "None"
                    ? input.PromoValue != 0
                    : !Rules.Text(input.PromoLabel, 100) || input.PromoValue <= 0
            )
            || (input.PromoKind == "Percent" && input.PromoValue > 100)
            || (input.PromoKind == "Fixed" && input.PromoValue > input.Price)
        )
            return Rules.Bad(
                "Check the product fields and discount. The discount cannot exceed the price or 100%."
            );
        var p =
            id == null
                ? new Product { ShopId = Access.Shop(ctx).Id }
                : await Products(ctx, db).SingleOrDefaultAsync(p => p.Id == id);
        if (p == null)
            return Results.NotFound();
        if (id != null && input.Version != p.Version)
            return Rules.Stale();
        p.Name = input.Name.Trim();
        p.Category = input.Category.Trim();
        p.Description = input.Description;
        p.Stock = input.Stock;
        p.Price = input.Price;
        p.WeightKg = input.WeightKg;
        p.ShippingCharge = input.ShippingCharge;
        p.ImageUrl = input.ImageUrl;
        if (input.Details != null)
            p.Details = input.Details.Trim();
        if (input.Gallery != null)
            p.Gallery = input.Gallery.Distinct().ToArray();
        p.PromoKind = input.PromoKind;
        p.PromoValue = input.PromoValue;
        p.PromoLabel = input.PromoKind == "None" ? "" : input.PromoLabel.Trim();
        p.Version++;
        if (id == null)
            db.Products.Add(p);
        await db.SaveChangesAsync();
        return Results.Ok(p);
    }
}
