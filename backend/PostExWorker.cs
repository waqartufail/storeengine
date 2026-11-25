using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

// Reserve the attempt durably before sending. Never resend an ambiguous booking automatically.
class PostExWorker(
    IServiceScopeFactory scopes,
    IHttpClientFactory clients,
    PostExCredentials credentials,
    ILogger<PostExWorker> log
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        while (!stop.IsCancellationRequested)
        {
            try
            {
                if (await ProcessOne(stop))
                    continue;
            }
            catch (OperationCanceledException) when (stop.IsCancellationRequested)
            {
                break;
            }
            catch (Exception e)
            {
                log.LogError("PostEx worker error ({Type}).", e.GetType().Name);
            }
            await Task.Delay(TimeSpan.FromSeconds(3), stop);
        }
    }

    async Task<bool> ProcessOne(CancellationToken stop)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDb>();
        Order? order;
        Shop? shop;
        Courier? courier;
        string? token;
        await using (var tx = await db.Database.BeginTransactionAsync(stop))
        {
            order = (
                await db
                    .Orders.FromSqlRaw(
                        """SELECT * FROM "Orders" WHERE "Booking"='Queued' ORDER BY "Id" LIMIT 1 FOR UPDATE SKIP LOCKED"""
                    )
                    .ToListAsync(stop)
            ).SingleOrDefault();
            if (order == null)
                return false;
            shop = await db.Shops.FindAsync(new object?[] { order.ShopId }, stop);
            if (shop is null)
            {
                order.Booking = "Review";
                await db.SaveChangesAsync(stop);
                await tx.CommitAsync(stop);
                return true;
            }
            try
            {
                token = credentials.Get(shop);
            }
            catch (Exception e)
                when (e
                        is System.Security.Cryptography.CryptographicException
                            or IOException
                            or UnauthorizedAccessException
                )
            {
                token = null;
                log.LogWarning("PostEx credentials need attention for store {StoreId}.", shop.Id);
            }
            courier = ShopConfig.Read(shop).Couriers.Find(c => c.Name == "PostEx" && c.Enabled);
            var send =
                shop.Available
                && courier != null
                && !string.IsNullOrWhiteSpace(token)
                && order.Status is not ("Cancelled" or "Delivered");
            order.Booking = send ? "Sending" : "Unbooked";
            order.BookingStarted = DateTime.UtcNow;
            await db.SaveChangesAsync(stop);
            await tx.CommitAsync(stop);
            if (!send)
                return true;
        }
        await db.Entry(order).Collection(o => o.Items).LoadAsync(stop);
        string? tracking = null;
        try
        {
            tracking = await PostExClient.CreateAsync(
                clients.CreateClient("postex"),
                order,
                courier!.PickupCode,
                token!,
                stop
            );
        }
        catch (Exception e)
            when (e is HttpRequestException or OperationCanceledException or JsonException)
        {
            log.LogWarning("Verify PostEx booking for order {Id} before retrying.", order.Id);
        }
        order.Tracking = Rules.Text(tracking, 120) ? tracking! : "";
        order.Booking = order.Tracking == "" ? "Review" : "Booked";
        await db.SaveChangesAsync(stop);
        return true;
    }
}
