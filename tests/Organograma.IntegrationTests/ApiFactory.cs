using System.Text.Json;
using Organograma.Application.Abstractions;
using Organograma.Application.Options;
using Organograma.Domain;
using Organograma.Domain.Entities;
using Organograma.Infrastructure.Cache;
using Organograma.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace Organograma.IntegrationTests;

public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private MongoDbContainer? _container;
    private IMongoClient? _client;

    public string ConnectionString { get; private set; } = "";
    public string DatabaseName { get; private set; } = "";
    public bool IsAvailable { get; private set; }
    public string? SkipReason { get; private set; }

    public async Task InitializeAsync()
    {
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("DISABLE_HANGFIRE", "true");
        DatabaseName = $"Organograma_it_{Guid.NewGuid():N}";

        if (await TryLocalMongoAsync())
        {
            IsAvailable = true;
            ApplyMongoEnv();
            return;
        }

        if (await TryTestcontainersAsync())
        {
            IsAvailable = true;
            ApplyMongoEnv();
            return;
        }

        IsAvailable = false;
        SkipReason ??= "MongoDB unavailable (localhost:27017 and Testcontainers/Docker both failed)";
    }

    private void ApplyMongoEnv()
    {
        Environment.SetEnvironmentVariable("MONGO_CONNECTING_FUNCIONARIOS", ConnectionString);
        Environment.SetEnvironmentVariable("JWT_SECRET", "integration_test_jwt_secret_change_me_32");
        Environment.SetEnvironmentVariable("JWT_EXPIRES_IN", "1h");
        Environment.SetEnvironmentVariable("RATE_LIMIT_MAX", "100000");
        Environment.SetEnvironmentVariable("REDIS_URL", "redis://127.0.0.1:6399");
    }

    private async Task<bool> TryLocalMongoAsync()
    {
        try
        {
            var client = new MongoClient(new MongoClientSettings
            {
                Server = new MongoServerAddress("localhost", 27017),
                ServerSelectionTimeout = TimeSpan.FromSeconds(2),
                ConnectTimeout = TimeSpan.FromSeconds(2),
            });
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            await client.GetDatabase("admin")
                .RunCommandAsync((Command<BsonDocument>)"{ping:1}", cancellationToken: cts.Token);
            // Reject localhost if it requires credentials our anonymous client can't use later.
            await client.GetDatabase(DatabaseName)
                .GetCollection<BsonDocument>("_ping")
                .InsertOneAsync(new BsonDocument("ok", 1), cancellationToken: cts.Token);
            await client.GetDatabase(DatabaseName).DropCollectionAsync("_ping", cts.Token);
            _client = client;
            ConnectionString = "mongodb://localhost:27017";
            return true;
        }
        catch (Exception ex)
        {
            SkipReason = $"localhost Mongo unavailable: {ex.Message}";
            return false;
        }
    }

    private async Task<bool> TryTestcontainersAsync()
    {
        try
        {
            _container = new MongoDbBuilder("mongo:7").Build();
            await _container.StartAsync();
            ConnectionString = _container.GetConnectionString();
            _client = new MongoClient(ConnectionString);
            await _client.GetDatabase(DatabaseName)
                .RunCommandAsync((Command<BsonDocument>)"{ping:1}");
            return true;
        }
        catch (Exception ex)
        {
            SkipReason = $"Testcontainers Mongo unavailable: {ex.Message}";
            _container = null;
            return false;
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            var conn = string.IsNullOrEmpty(ConnectionString)
                ? "mongodb://localhost:27017"
                : ConnectionString;

            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ASPNETCORE_ENVIRONMENT"] = "Testing",
                ["DISABLE_HANGFIRE"] = "true",
                ["Mongo:ConnectionString"] = conn,
                ["Mongo:DatabaseName"] = DatabaseName,
                ["MONGO_CONNECTING_FUNCIONARIOS"] = conn,
                ["Jwt:Secret"] = "integration_test_jwt_secret_change_me_32",
                ["JWT_SECRET"] = "integration_test_jwt_secret_change_me_32",
                ["Jwt:ExpiresIn"] = "1h",
                ["JWT_EXPIRES_IN"] = "1h",
                ["RATE_LIMIT_MAX"] = "100000",
                ["PORT"] = "0",
                ["REDIS_URL"] = "redis://127.0.0.1:6399",
                ["Redis:Url"] = "redis://127.0.0.1:6399",
                ["Cors:BaseDomain"] = "",
                ["Cors:Origins"] = "http://localhost",
            });
        });

        builder.ConfigureTestServices(services =>
        {
            foreach (var descriptor in services.Where(d => d.ServiceType == typeof(IHostedService)).ToList())
                services.Remove(descriptor);

            foreach (var descriptor in services.Where(d => d.ServiceType == typeof(ICacheService)).ToList())
                services.Remove(descriptor);
            services.AddSingleton<ICacheService, NullCacheService>();

            // Force the same Mongo endpoint/db the fixture seeded into.
            var conn = ConnectionString;
            var dbName = DatabaseName;
            services.PostConfigure<MongoOptions>(o =>
            {
                o.ConnectionString = conn;
                o.DatabaseName = dbName;
            });

            foreach (var descriptor in services.Where(d => d.ServiceType == typeof(MongoDbContext)).ToList())
                services.Remove(descriptor);
            services.AddSingleton(sp =>
            {
                var opts = Microsoft.Extensions.Options.Options.Create(new MongoOptions
                {
                    ConnectionString = conn,
                    DatabaseName = dbName,
                });
                return new MongoDbContext(opts);
            });
        });
    }

    public HttpClient CreateClientForHost(string host)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });
        client.DefaultRequestHeaders.Host = host;
        return client;
    }

    private IMongoDatabase GetTestDatabase()
    {
        EnsureAvailable();
        if (_client is null)
            throw new InvalidOperationException("Mongo client was not initialized.");
        return _client.GetDatabase(DatabaseName);
    }

    public async Task<(Tenant Tenant, User User, string Password)> SeedTenantUserAsync(
        string slug,
        string username,
        string role = Roles.Owner)
    {
        var db = GetTestDatabase();
        var now = DateTime.UtcNow;
        var tenant = new Tenant
        {
            Id = ObjectId.GenerateNewId(),
            Slug = slug,
            Name = $"Tenant {slug}",
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now,
        };
        await db.GetCollection<Tenant>(MongoDbContext.TenantsCollection).InsertOneAsync(tenant);

        const string password = "Passw0rd!";
        var user = new User
        {
            Id = ObjectId.GenerateNewId(),
            LoginId = $"{slug}-admin",
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 4),
            Role = role,
            TenantId = tenant.Id,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await db.GetCollection<User>(MongoDbContext.UsersCollection).InsertOneAsync(user);
        return (tenant, user, password);
    }

    public async Task<User> SeedSuperadminAsync(string loginId = "superadmin", string password = "Passw0rd!")
    {
        var db = GetTestDatabase();
        var now = DateTime.UtcNow;
        var user = new User
        {
            Id = ObjectId.GenerateNewId(),
            LoginId = loginId,
            Username = loginId,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 4),
            Role = Roles.Superadmin,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await db.GetCollection<User>(MongoDbContext.UsersCollection).InsertOneAsync(user);
        return user;
    }

    public void EnsureAvailable()
        => Skip.IfNot(IsAvailable, SkipReason ?? "MongoDB unavailable");

    async Task IAsyncLifetime.DisposeAsync()
    {
        try
        {
            if (_client is not null && !string.IsNullOrEmpty(DatabaseName))
                await _client.DropDatabaseAsync(DatabaseName);
        }
        catch
        {
            // best-effort cleanup
        }

        await DisposeAsync();

        if (_container is not null)
            await _container.DisposeAsync();

        Environment.SetEnvironmentVariable("DISABLE_HANGFIRE", null);
        Environment.SetEnvironmentVariable("MONGO_CONNECTING_FUNCIONARIOS", null);
    }
}

[CollectionDefinition("Integration")]
public sealed class IntegrationCollection : ICollectionFixture<ApiFactory>;

internal static class JsonHelpers
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static async Task<JsonElement> ReadJsonAsync(this HttpResponseMessage response)
    {
        var stream = await response.Content.ReadAsStreamAsync();
        return await JsonSerializer.DeserializeAsync<JsonElement>(stream, Options);
    }

    public static void AddCookie(this HttpClient client, string name, string value)
    {
        client.DefaultRequestHeaders.Remove("Cookie");
        client.DefaultRequestHeaders.Add("Cookie", $"{name}={value}");
    }

    public static string? GetSetCookieValue(this HttpResponseMessage response, string name)
    {
        if (!response.Headers.TryGetValues("Set-Cookie", out var cookies))
            return null;

        foreach (var cookie in cookies)
        {
            if (!cookie.StartsWith($"{name}=", StringComparison.OrdinalIgnoreCase))
                continue;
            var part = cookie.Split(';', 2)[0];
            var eq = part.IndexOf('=');
            return eq >= 0 ? part[(eq + 1)..] : null;
        }

        return null;
    }
}
