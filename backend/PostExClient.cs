using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;

static class PostExClient
{
    public static string? LocalPhone(string phone)
    {
        var digits = Regex.Replace(phone, "[^0-9]", "");
        if (digits.StartsWith("0092"))
            digits = "0" + digits[4..];
        else if (digits.StartsWith("92"))
            digits = "0" + digits[2..];
        return Regex.IsMatch(digits, "^03[0-9]{9}$") ? digits : null;
    }

    // A missing confirmation must be reconciled with the merchant before another POST.
    public static async Task<string?> CreateAsync(
        HttpClient http,
        Order order,
        string pickup,
        string token,
        CancellationToken stop
    )
    {
        const string url = "https://api.postex.pk/services/integration/api/order/v3/create-order";
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("token", token);
        request.Content = JsonContent.Create(
            new
            {
                cityName = order.City,
                customerName = order.CustomerName,
                customerPhone = LocalPhone(order.Phone),
                deliveryAddress = order.Address,
                invoiceDivision = 1,
                invoicePayment = order.IsCod ? order.Total : 0m,
                items = order.Items.Sum(i => i.Quantity),
                orderDetail = string.Join(
                    ", ",
                    order.Items.Select(i => $"{i.ProductName} x {i.Quantity}")
                ),
                orderRefNumber = $"NW-{order.ShopId}-{order.Id}",
                orderType = "Normal",
                transactionNotes = "",
                pickupAddressCode = pickup,
            }
        );
        using var response = await http.SendAsync(request, stop);
        if (!response.IsSuccessStatusCode)
            return null;
        using var json = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(stop),
            cancellationToken: stop
        );
        var root = json.RootElement;
        if (
            root.ValueKind != JsonValueKind.Object
            || !root.TryGetProperty("statusCode", out var code)
            || code.ToString() != "200"
            || !root.TryGetProperty("dist", out var dist)
            || dist.ValueKind != JsonValueKind.Object
            || !dist.TryGetProperty("trackingNumber", out var number)
            || number.ValueKind != JsonValueKind.String
        )
            return null;
        return Rules.Text(number.GetString(), 120) ? number.GetString() : null;
    }
}
