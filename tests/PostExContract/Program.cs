using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;

var directory = Directory.CreateTempSubdirectory("nw-postex-");
try
{
    var config = new ConfigurationBuilder()
        .AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["PostEx:Stores:9:Token"] = "legacy-fixture",
                ["PostEx:SecretDirectory"] = directory.FullName,
            }
        )
        .Build();
    var vault = new PostExCredentials(new EphemeralDataProtectionProvider(), config);
    var merchant = new Shop { Id = 9 };
    Check(vault.Get(merchant) == "legacy-fixture");
    vault.Set(merchant, "replacement-fixture");
    Check(
        merchant.PostExSecret != "replacement-fixture"
            && vault.Get(merchant) == "replacement-fixture"
    );
    Check(!JsonSerializer.Serialize(merchant).Contains(merchant.PostExSecret));
    try
    {
        vault.Get(new Shop { Id = 10, PostExSecret = merchant.PostExSecret });
        throw new Exception("Cross-tenant token reuse");
    }
    catch (System.Security.Cryptography.CryptographicException) { }
    var fileMerchant = new Shop { Id = 11, Email = "Merchant@Example.test" };
    var digest = System.Security.Cryptography.SHA256.HashData("merchant@example.test"u8);
    var filename = Convert.ToHexString(digest).ToLowerInvariant() + ".token";
    await File.WriteAllTextAsync(Path.Combine(directory.FullName, filename), "private-file-token");
    Check(vault.Configured(fileMerchant) && vault.Get(fileMerchant) == "private-file-token");
    Check(!vault.Configured(new Shop { Id = 12, Email = "other@example.test" }));
}
finally
{
    directory.Delete(true);
}
Console.WriteLine(
    "PASS token encryption, merchant binding, replacement, private file and legacy fallback"
);
var o = new Order
{
    Id = 17,
    ShopId = 9,
    Phone = "+92 300 1234567",
    CustomerName = "QA",
    City = "Lahore",
    Address = "Test lane",
    Total = 345.50m,
    IsCod = true,
    Items = [new() { ProductName = "Honey", Quantity = 2 }],
};
var handler = new Stub();
using var client = new HttpClient(handler);
var tracking = await PostExClient.CreateAsync(client, o, "WH1", "test-token", default);
Check(tracking == "CX-TEST" && handler.Body.GetProperty("invoicePayment").GetDecimal() == 345.50m);
Check(handler.Body.GetProperty("customerPhone").GetString() == "03001234567");
Check(handler.Body.GetProperty("orderRefNumber").GetString() == "NW-9-17");
Check(
    handler.Body.GetProperty("items").GetInt32() == 2
        && handler.Body.GetProperty("pickupAddressCode").GetString() == "WH1"
);
o.IsCod = false;
await PostExClient.CreateAsync(client, o, "WH1", "test-token", default);
Check(handler.Body.GetProperty("invoicePayment").GetDecimal() == 0);
handler.Json = """{"statusCode":"400","statusMessage":"invalid"}""";
Check(await PostExClient.CreateAsync(client, o, "WH1", "test-token", default) == null);
handler.Json = """{"statusCode":"200","dist":{}}""";
Check(await PostExClient.CreateAsync(client, o, "WH1", "test-token", default) == null);
handler.Status = HttpStatusCode.BadGateway;
Check(await PostExClient.CreateAsync(client, o, "WH1", "test-token", default) == null);
Check(PostExClient.LocalPhone("invalid") == null);
Console.WriteLine(
    "PASS PostEx stub transport: merchant URL and token header, normalized phone, payload, prepaid/COD, tracking, declined and ambiguous responses."
);
static void Check(bool ok)
{
    if (!ok)
        throw new Exception("PostEx contract assertion failed.");
}

class Stub : HttpMessageHandler
{
    public string Json = """{"statusCode":"200","dist":{"trackingNumber":"CX-TEST"}}""";
    public HttpStatusCode Status = HttpStatusCode.OK;
    public JsonElement Body;

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken stop
    )
    {
        if (
            request.Method != HttpMethod.Post
            || request.RequestUri?.AbsoluteUri
                != "https://api.postex.pk/services/integration/api/order/v3/create-order"
            || request.Headers.GetValues("token").Single() != "test-token"
        )
            throw new Exception("Unexpected PostEx request");
        using var json = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(stop));
        Body = json.RootElement.Clone();
        return new HttpResponseMessage(Status) { Content = new StringContent(Json) };
    }
}
