using Microsoft.EntityFrameworkCore;

class StoreDb(DbContextOptions<StoreDb> options) : DbContext(options)
{
    public DbSet<Shop> Shops => Set<Shop>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Product>().Property(x => x.Price).HasPrecision(12, 2);
        b.Entity<Order>().Property(x => x.Total).HasPrecision(12, 2);
        b.Entity<OrderItem>().Property(x => x.UnitPrice).HasPrecision(12, 2);
        b.Entity<Order>()
            .HasMany(x => x.Items)
            .WithOne()
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

class Product
{
    public string Details { get; set; } = "";
    public string[] Gallery { get; set; } = [];
    public int? ShopId { get; set; }
    public long Version { get; set; }
    public decimal WeightKg { get; set; } = 0.5m;
    public decimal ShippingCharge { get; set; }
    public string PromoLabel { get; set; } = "";
    public string PromoKind { get; set; } = "None";
    public decimal PromoValue { get; set; }
    public decimal SalePrice =>
        Math.Round(
            Price
                - (
                    PromoKind == "Percent" ? Price * PromoValue / 100
                    : PromoKind == "Fixed" ? PromoValue
                    : 0
                ),
            2,
            MidpointRounding.AwayFromZero
        );
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Category { get; set; } = "General";
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public string ImageUrl { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

class Order
{
    public bool IsCod { get; set; } = true;
    public DateTime? BookingStarted { get; set; }
    public int? ShopId { get; set; }
    public string RequestId { get; set; } = "";
    public string Courier { get; set; } = "";
    public string Booking { get; set; } = "Unbooked";
    public string Tracking { get; set; } = "";
    public string PaymentReference { get; set; } = "";
    public bool PaymentVerified { get; set; }
    public decimal WeightKg { get; set; }
    public decimal Shipping { get; set; }
    public decimal Subtotal { get; set; }
    public int Id { get; set; }
    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public string City { get; set; } = "";
    public string PaymentMethod { get; set; } = "Cash on Delivery";
    public string Status { get; set; } = "Pending";
    public decimal Total { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<OrderItem> Items { get; set; } = [];
}

class OrderItem
{
    public decimal ListPrice { get; set; }
    public string PromoLabel { get; set; } = "";
    public decimal WeightKg { get; set; }
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
}

class Shop
{
    [System.Text.Json.Serialization.JsonIgnore]
    public string PostExSecret { get; set; } = "";
    public int Id { get; set; }
    public string Slug { get; set; } = "";
    public string Email { get; set; } = "";
    public string AdminName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Name { get; set; } = "";
    public string BrowserTitle { get; set; } = "";
    public string Logo { get; set; } = "";
    public string Banner { get; set; } = "";
    public string PromoVideo { get; set; } = "";
    public string SocialLinksJson { get; set; } = "[]";
    public string Theme { get; set; } = "royal";
    public string Status { get; set; } = "Pending";
    public string Plan { get; set; } = "";
    public DateTime? ExpiresAt { get; set; }
    public long SessionVersion { get; set; }
    public long SettingsVersion { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string ConfigJson { get; set; } = ShopConfig.Serialize(new());
    public bool Available =>
        Status == "Active" && (ExpiresAt == null || ExpiresAt > DateTime.UtcNow);
}

record Shipping(decimal BaseCharge = 200, decimal IncludedWeight = 5, decimal ExtraPerKg = 50);

record Courier(
    string Name,
    bool Enabled = false,
    string PickupCode = "",
    string Notes = "",
    string ApiUrl = ""
);

record Payment(
    string Name,
    string Kind,
    bool Enabled = false,
    string Details = "",
    string Qr = "",
    string Url = ""
);

record WhatsApp(
    bool Enabled = false,
    string BusinessPhone = "",
    string Template = "order_confirmation",
    string PhoneId = ""
);

class ShopConfig
{
    public Shipping Shipping { get; set; } = new();
    public string DefaultShipper { get; set; } = "PostEx";
    public List<Courier> Couriers { get; set; } =
        [new("PostEx", true), new("TCS"), new("Leopards"), new("M&P")];
    public WhatsApp WhatsApp { get; set; } = new();
    public List<Payment> Payments { get; set; } =
        [
            new("Cash on Delivery", "cod", true, "Pay on delivery"),
            new("Easypaisa", "online"),
            new("JazzCash", "online"),
            new("Bank Transfer", "online"),
            new("Card Payment", "card"),
        ];

    public static string Serialize(ShopConfig c) => System.Text.Json.JsonSerializer.Serialize(c);

    public static ShopConfig Read(Shop s) =>
        System.Text.Json.JsonSerializer.Deserialize<ShopConfig>(s.ConfigJson)!;
}

record Signup(string AdminName, string Email, string Password, string Name);

record Login(string Email, string Password);

record Decision(string Action, string Plan);

record Branding(
    string Name,
    string BrowserTitle,
    string Logo,
    string Banner,
    string Theme,
    long Version,
    string? PromoVideo = null,
    SocialLink[]? SocialLinks = null
);

record SocialLink(string Label, string Url);

record ConfigEdit(ShopConfig Config, long Version);

record ProductInput(
    string Name,
    string Description,
    string Category,
    decimal Price,
    int Stock,
    decimal WeightKg,
    decimal ShippingCharge,
    string ImageUrl,
    string PromoLabel,
    string PromoKind,
    decimal PromoValue,
    long Version,
    string? Details = null,
    string[]? Gallery = null
);

record OrderLine(int ProductId, int Quantity);

record Checkout(
    string CustomerName,
    string Phone,
    string Address,
    string City,
    string PaymentMethod,
    string PaymentReference,
    string RequestId,
    List<OrderLine> Items,
    decimal ExpectedTotal
);

record StatusEdit(string Status);

record BookingUpdate(string Tracking, bool ConfirmUnbooked);
