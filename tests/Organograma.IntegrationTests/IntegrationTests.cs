using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Organograma.IntegrationTests;

[Collection("Integration")]
public class HealthEndpointTests
{
    private readonly ApiFactory _factory;

    public HealthEndpointTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Root_returns_ok_service_shape()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/");
        response.EnsureSuccessStatusCode();

        var json = await response.ReadJsonAsync();
        Assert.Equal("ok", json.GetProperty("status").GetString());
        Assert.Equal("api-organograma", json.GetProperty("service").GetString());
    }

    [Fact]
    public async Task Health_returns_healthy_with_uptime()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");
        response.EnsureSuccessStatusCode();

        var json = await response.ReadJsonAsync();
        Assert.Equal("healthy", json.GetProperty("status").GetString());
        Assert.True(json.TryGetProperty("uptime", out var uptime));
        Assert.True(uptime.GetDouble() >= 0);
    }
}

[Collection("Integration")]
public class AuthContractTests
{
    private readonly ApiFactory _factory;

    public AuthContractTests(ApiFactory factory) => _factory = factory;

    [SkippableFact]
    public async Task Login_sets_authToken_cookie_and_verify_authenticated()
    {
        _factory.EnsureAvailable();
        var slug = $"auth{Guid.NewGuid():N}"[..12];
        var (_, user, password) = await _factory.SeedTenantUserAsync(slug, "auth-user");

        var client = _factory.CreateClientForHost($"{slug}.localhost");
        var login = await client.PostAsJsonAsync("/api/usuarios/login", new
        {
            id = user.LoginId,
            password,
        });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        var loginBody = await login.ReadJsonAsync();
        Assert.True(loginBody.GetProperty("authenticated").GetBoolean());
        Assert.Equal(user.Username, loginBody.GetProperty("username").GetString());
        Assert.Equal(user.Role, loginBody.GetProperty("role").GetString());

        var token = login.GetSetCookieValue("authToken");
        Assert.False(string.IsNullOrWhiteSpace(token));

        client.AddCookie("authToken", token!);
        var verify = await client.GetAsync("/api/usuarios/verify");
        Assert.Equal(HttpStatusCode.OK, verify.StatusCode);
        var verifyBody = await verify.ReadJsonAsync();
        Assert.True(verifyBody.GetProperty("authenticated").GetBoolean());
        Assert.Equal(user.Username, verifyBody.GetProperty("username").GetString());
    }

    [SkippableFact]
    public async Task Login_response_contract_has_authenticated_username_role()
    {
        _factory.EnsureAvailable();
        var slug = $"ctr{Guid.NewGuid():N}"[..12];
        var (_, user, password) = await _factory.SeedTenantUserAsync(slug, "contract-user");

        var client = _factory.CreateClientForHost($"{slug}.localhost");
        var login = await client.PostAsJsonAsync("/api/usuarios/login", new
        {
            id = user.LoginId,
            password,
        });
        login.EnsureSuccessStatusCode();

        var body = await login.ReadJsonAsync();
        Assert.True(body.TryGetProperty("authenticated", out _));
        Assert.True(body.TryGetProperty("username", out _));
        Assert.True(body.TryGetProperty("role", out _));
        Assert.True(body.GetProperty("authenticated").GetBoolean());
        Assert.Equal("contract-user", body.GetProperty("username").GetString());
        Assert.Equal("owner", body.GetProperty("role").GetString());
    }
}

[Collection("Integration")]
public class ErrorFilterTests
{
    private readonly ApiFactory _factory;

    public ErrorFilterTests(ApiFactory factory) => _factory = factory;

    [SkippableFact]
    public async Task AppException_returns_error_code_message_shape()
    {
        _factory.EnsureAvailable();
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/tenants/by-slug/does-not-exist-xyz");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var json = await response.ReadJsonAsync();
        Assert.True(json.GetProperty("error").GetBoolean());
        Assert.Equal("TENANT_NOT_FOUND", json.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(json.GetProperty("message").GetString()));
    }

    [SkippableFact]
    public async Task Invalid_login_returns_error_shape()
    {
        _factory.EnsureAvailable();
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/usuarios/login", new
        {
            id = "nobody",
            password = "wrong",
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var json = await response.ReadJsonAsync();
        Assert.True(json.GetProperty("error").GetBoolean());
        Assert.Equal("INVALID_CREDENTIALS", json.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(json.GetProperty("message").GetString()));
    }
}

[Collection("Integration")]
public class TenantIsolationTests
{
    private readonly ApiFactory _factory;

    public TenantIsolationTests(ApiFactory factory) => _factory = factory;

    [SkippableFact]
    public async Task Setor_created_by_tenant_A_is_invisible_to_tenant_B()
    {
        _factory.EnsureAvailable();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var slugA = $"ta{suffix}";
        var slugB = $"tb{suffix}";

        var (_, userA, passA) = await _factory.SeedTenantUserAsync(slugA, "user-a");
        var (_, userB, passB) = await _factory.SeedTenantUserAsync(slugB, "user-b");

        var clientA = _factory.CreateClientForHost($"{slugA}.localhost");
        var loginA = await clientA.PostAsJsonAsync("/api/usuarios/login", new { id = userA.LoginId, password = passA });
        loginA.EnsureSuccessStatusCode();
        clientA.AddCookie("authToken", loginA.GetSetCookieValue("authToken")!);

        var setorNome = $"Setor-A-{suffix}";
        var create = await clientA.PostAsJsonAsync("/api/setores", new
        {
            nome = setorNome,
            tipo = "Setor",
        });
        create.EnsureSuccessStatusCode();
        var created = await create.ReadJsonAsync();
        Assert.True(created.TryGetProperty("_id", out _));
        var normalizedNome = created.GetProperty("nome").GetString();
        Assert.False(string.IsNullOrWhiteSpace(normalizedNome));

        var listA = await clientA.GetAsync("/api/setores/roots");
        listA.EnsureSuccessStatusCode();
        var rootsA = await listA.ReadJsonAsync();
        var childrenA = rootsA.GetProperty("children");
        Assert.True(ContainsNome(childrenA, normalizedNome!));

        var clientB = _factory.CreateClientForHost($"{slugB}.localhost");
        var loginB = await clientB.PostAsJsonAsync("/api/usuarios/login", new { id = userB.LoginId, password = passB });
        loginB.EnsureSuccessStatusCode();
        clientB.AddCookie("authToken", loginB.GetSetCookieValue("authToken")!);

        var listB = await clientB.GetAsync("/api/setores/roots");
        listB.EnsureSuccessStatusCode();
        var rootsB = await listB.ReadJsonAsync();
        var childrenB = rootsB.GetProperty("children");
        Assert.False(ContainsNome(childrenB, normalizedNome!));
    }

    private static bool ContainsNome(JsonElement children, string nome)
    {
        if (children.ValueKind != JsonValueKind.Array) return false;
        foreach (var child in children.EnumerateArray())
        {
            if (child.TryGetProperty("nome", out var n) && n.GetString() == nome)
                return true;
        }
        return false;
    }
}

[Collection("Integration")]
public class TenantSeedFlowTests
{
    private readonly ApiFactory _factory;

    public TenantSeedFlowTests(ApiFactory factory) => _factory = factory;

    [SkippableFact]
    public async Task Superadmin_can_create_tenant_with_admin_and_login()
    {
        _factory.EnsureAvailable();
        await _factory.SeedSuperadminAsync();

        var client = _factory.CreateClient();
        var superLogin = await client.PostAsJsonAsync("/api/usuarios/login", new
        {
            id = "superadmin",
            password = "Passw0rd!",
        });
        superLogin.EnsureSuccessStatusCode();
        client.AddCookie("authToken", superLogin.GetSetCookieValue("authToken")!);

        var slug = $"new{Guid.NewGuid():N}"[..12];
        var create = await client.PostAsJsonAsync("/api/tenants", new
        {
            slug,
            name = "New Tenant",
            admin = new
            {
                id = $"{slug}-owner",
                username = "owner-user",
                password = "Passw0rd!",
            },
            settings = new { seedOnCreate = false },
        });
        create.EnsureSuccessStatusCode();

        var tenantClient = _factory.CreateClientForHost($"{slug}.localhost");
        var login = await tenantClient.PostAsJsonAsync("/api/usuarios/login", new
        {
            id = $"{slug}-owner",
            password = "Passw0rd!",
        });
        login.EnsureSuccessStatusCode();
        var body = await login.ReadJsonAsync();
        Assert.True(body.GetProperty("authenticated").GetBoolean());
        Assert.Equal("owner-user", body.GetProperty("username").GetString());
        Assert.Equal("owner", body.GetProperty("role").GetString());
    }
}
