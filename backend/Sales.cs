using Microsoft.EntityFrameworkCore;

static class Sales
{
    public static void Map(RouteGroupBuilder admin, RouteGroupBuilder store)
    {
        store.MapPost("/orders", CheckoutOrder);
        admin.MapGet(
            "/orders",
            async (HttpContext ctx, StoreDb db) =>
                await Orders(ctx, db)
                    .Include(o => o.Items)
                    .OrderByDescending(o => o.CreatedAt)
                    .ToListAsync()
        );
        admin.MapGet(
            "/orders/{id:int}",
            async (int id, HttpContext ctx, StoreDb db) =>
                await Orders(ctx, db).Include(o => o.Items).SingleOrDefaultAsync(o => o.Id == id)
                    is { } o
                    ? Results.Ok(o)
                    : Results.NotFound()
        );
        admin.MapPatch(
            "/orders/{id:int}/status",
            async (int id, StatusEdit req, HttpContext ctx, StoreDb db) =>
            {
                if (!Rules.Statuses.Contains(req.Status))
                    return Rules.Bad("Invalid order status.");
                var o = await Orders(ctx, db).SingleOrDefaultAsync(o => o.Id == id);
                if (o == null)
                    return Results.NotFound();
                o.Status = req.Status;
                await db.SaveChangesAsync();
                return Results.Ok();
            }
        );
        admin.MapPost(
            "/orders/{id:int}/verify-payment",
            async (int id, HttpContext ctx, StoreDb db) =>
            {
                var o = await Orders(ctx, db).SingleOrDefaultAsync(o => o.Id == id);
                if (o == null)
                    return Results.NotFound();
                if (o.IsCod)
                    return Rules.Bad("COD is collected on delivery.");
                o.PaymentVerified = true;
                await db.SaveChangesAsync();
                return Results.Ok();
            }
        );
        admin.MapPost(
            "/orders/{id:int}/book",
            async (int id, HttpContext ctx, StoreDb db, PostExCredentials credentials) =>
            {
                var s = Access.Shop(ctx);
                var o = await Orders(ctx, db).SingleOrDefaultAsync(o => o.Id == id);
                if (o == null)
                    return Results.NotFound();
                if (
                    o.Booking != "Unbooked"
                    || o.Courier != "PostEx"
                    || o.Status is "Cancelled" or "Delivered"
                    || (!o.IsCod && !o.PaymentVerified)
                )
                    return Rules.Bad(
                        "Check the courier, order status, payment and existing booking."
                    );
                if (PostExClient.LocalPhone(o.Phone) == null)
                    return Rules.Bad(
                        "PostEx requires a Pakistani mobile number. Use manual dispatch for this order."
                    );
                if (
                    !ShopConfig.Read(s).Couriers.Any(c => c.Name == "PostEx" && c.Enabled)
                    || !credentials.Configured(s)
                )
                    return Rules.Bad(
                        "Enable PostEx and configure the server token for this store."
                    );
                o.Booking = "Queued";
                await db.SaveChangesAsync();
                return Results.Accepted();
            }
        );
        admin.MapPost(
            "/orders/{id:int}/tracking",
            async (int id, BookingUpdate req, HttpContext ctx, StoreDb db) =>
            {
                var o = await Orders(ctx, db).SingleOrDefaultAsync(o => o.Id == id);
                if (o == null)
                    return Results.NotFound();
                if (
                    o.Booking == "Booked"
                    || o.Booking == "Queued"
                    || (o.Booking == "Sending" && o.BookingStarted > DateTime.UtcNow.AddMinutes(-2))
                )
                    return Rules.Bad("This booking is already complete or in progress.");
                if (req.ConfirmUnbooked)
                {
                    o.Booking = "Unbooked";
                    o.Tracking = "";
                }
                else
                {
                    if (!Rules.Text(req.Tracking, 120))
                        return Rules.Bad("Enter a verified tracking number.");
                    o.Tracking = req.Tracking.Trim();
                    o.Booking = "Booked";
                }
                await db.SaveChangesAsync();
                return Results.Ok();
            }
        );
    }

    static IQueryable<Order> Orders(HttpContext ctx, StoreDb db)
    {
        var id = Access.Shop(ctx).Id;
        return db.Orders.Where(o => o.ShopId == id);
    }

    static object Receipt(Order o) =>
        new
        {
            o.Id,
            o.Subtotal,
            o.Shipping,
            o.Total,
            o.WeightKg,
            o.PaymentMethod,
        };

    static async Task<IResult> CheckoutOrder(Checkout req, HttpContext ctx, StoreDb db)
    {
        var s = Access.Shop(ctx);
        if (
            !Guid.TryParseExact(req.RequestId, "D", out _)
            || !Rules.Text(req.CustomerName, 120)
            || !Rules.Text(req.Phone, 32)
            || !Rules.Text(req.City, 100)
            || !Rules.Text(req.Address, 600)
            || !Rules.Optional(req.PaymentReference, 150)
            || req.Items is not { Count: > 0 and <= 100 }
            || req.Items.Any(i => i == null || i.Quantity is < 1 or > 1000)
            || req.Items.Select(i => i.ProductId).Distinct().Count() != req.Items.Count
        )
            return Rules.Bad("Check delivery details and item quantities.");
        var previous = await Orders(ctx, db)
            .SingleOrDefaultAsync(o => o.RequestId == req.RequestId);
        if (previous != null)
            return Results.Ok(Receipt(previous));
        var config = ShopConfig.Read(s);
        var payment = config.Payments.Find(p => p.Enabled && p.Name == req.PaymentMethod);
        if (payment == null || (payment.Kind != "cod" && !Rules.Text(req.PaymentReference, 150)))
            return Rules.Bad("Choose an available payment method and enter the payment reference.");
        var ids = req.Items.Select(i => i.ProductId).ToList();
        var products = await db
            .Products.Where(p => p.ShopId == s.Id && p.IsActive && ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);
        var o = new Order
        {
            ShopId = s.Id,
            CustomerName = req.CustomerName.Trim(),
            Phone = req.Phone.Trim(),
            City = req.City.Trim(),
            Address = req.Address.Trim(),
            RequestId = req.RequestId,
            PaymentMethod = payment.Name,
            IsCod = payment.Kind == "cod",
            PaymentReference = payment.Kind == "cod" ? "" : req.PaymentReference.Trim(),
            Courier = config.DefaultShipper,
        };
        decimal highest = 0;
        foreach (var item in req.Items)
        {
            if (!products.TryGetValue(item.ProductId, out var p) || p.Stock < item.Quantity)
                return Results.Conflict(new { message = "Stock changed. Refresh your bag." });
            p.Stock -= item.Quantity;
            p.Version++;
            highest = Math.Max(highest, p.ShippingCharge);
            o.WeightKg += p.WeightKg * item.Quantity;
            o.Subtotal += p.SalePrice * item.Quantity;
            o.Items.Add(
                new OrderItem
                {
                    ProductId = p.Id,
                    ProductName = p.Name,
                    UnitPrice = p.SalePrice,
                    ListPrice = p.Price,
                    PromoLabel = p.PromoLabel,
                    WeightKg = p.WeightKg,
                    Quantity = item.Quantity,
                }
            );
        }
        var rate = config.Shipping;
        o.Shipping =
            (highest > 0 ? highest : rate.BaseCharge)
            + Math.Max(0, decimal.Ceiling(o.WeightKg - rate.IncludedWeight)) * rate.ExtraPerKg;
        o.Total = o.Subtotal + o.Shipping;
        if (o.Total != req.ExpectedTotal || o.Total > 9999999999.99m)
            return Results.Conflict(
                new
                {
                    message = "Order total changed or exceeds the limit. Refresh and review your bag.",
                }
            );
        db.Orders.Add(o);
        await db.SaveChangesAsync();
        return Results.Ok(Receipt(o));
    }
}
