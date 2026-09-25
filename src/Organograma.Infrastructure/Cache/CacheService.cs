using System.Text.Json;
using Organograma.Application.Abstractions;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Organograma.Infrastructure.Cache;

public sealed class CacheService : ICacheService
{
    private readonly IDatabase _db;
    private readonly ILogger<CacheService> _logger;

    public CacheService(IConnectionMultiplexer mux, ILogger<CacheService> logger)
    {
        _db = mux.GetDatabase();
        _logger = logger;
    }

    public string VersionCounterKey(string? tenantId = null)
        => tenantId is not null ? $"tenant:{tenantId}:cache:v" : "cache:v";

    public string? ExtractTenantId(string key)
    {
        var m = System.Text.RegularExpressions.Regex.Match(key, @"^tenant:([^:]+):");
        return m.Success ? m.Groups[1].Value : null;
    }

    public string TenantKey(string? tenantId, string suffix)
    {
        if (string.IsNullOrEmpty(suffix)) return tenantId is not null ? $"tenant:{tenantId}:" : "";
        return tenantId is not null ? $"tenant:{tenantId}:{suffix}" : suffix;
    }

    public async Task<string> GetVersionAsync(string? tenantId = null, CancellationToken ct = default)
    {
        var v = await _db.StringGetAsync(VersionCounterKey(tenantId));
        return v.HasValue ? v.ToString() : "0";
    }

    public async Task<long> BumpVersionAsync(string? tenantId = null, CancellationToken ct = default)
        => await _db.StringIncrementAsync(VersionCounterKey(tenantId));

    public async Task<string> ResolveKeyAsync(string key, CancellationToken ct = default)
    {
        var raw = key;
        if (raw.EndsWith(":cache:v", StringComparison.Ordinal) || raw == "cache:v") return raw;

        var tenantId = ExtractTenantId(raw);
        var version = await GetVersionAsync(tenantId, ct);

        if (tenantId is not null)
            return raw.Replace($"tenant:{tenantId}:", $"tenant:{tenantId}:v{version}:", StringComparison.Ordinal);
        return $"v{version}:{raw}";
    }

    public async Task<T> GetOrSetCacheAsync<T>(
        string key,
        Func<Task<T>> fetchFunction,
        int ttlSeconds = 3600,
        CancellationToken ct = default)
    {
        var cacheKey = await ResolveKeyAsync(key, ct);
        var cached = await _db.StringGetAsync(cacheKey);
        if (cached.HasValue)
            return JsonSerializer.Deserialize<T>((string)cached!)!;

        var fresh = await fetchFunction();
        if (fresh is not null)
        {
            await _db.StringSetAsync(
                cacheKey,
                JsonSerializer.Serialize(fresh),
                TimeSpan.FromSeconds(ttlSeconds));
        }
        return fresh;
    }

    public async Task ClearCacheForSetorAsync(string? id, string? tenantId = null, CancellationToken ct = default)
    {
        _ = id;
        await BumpVersionAsync(tenantId, ct);
        if (tenantId is not null) await BumpVersionAsync(null, ct);
    }

    public async Task ClearCacheForFuncionariosAsync(string? tenantId = null, CancellationToken ct = default)
    {
        await BumpVersionAsync(tenantId, ct);
        if (tenantId is not null) await BumpVersionAsync(null, ct);
    }

    public Task ClearCacheForDivisoesAsync(string? tenantId = null, CancellationToken ct = default)
        => BumpVersionAsync(tenantId, ct);

    public Task ClearCacheForCoordChangeAsync(string? tenantId, CancellationToken ct = default)
        => BumpVersionAsync(tenantId, ct);
}

/// <summary>No-op cache used when Redis is unavailable.</summary>
public sealed class NullCacheService : ICacheService
{
    public string VersionCounterKey(string? tenantId = null)
        => tenantId is not null ? $"tenant:{tenantId}:cache:v" : "cache:v";

    public string? ExtractTenantId(string key)
    {
        var m = System.Text.RegularExpressions.Regex.Match(key, @"^tenant:([^:]+):");
        return m.Success ? m.Groups[1].Value : null;
    }

    public string TenantKey(string? tenantId, string suffix)
        => tenantId is not null ? $"tenant:{tenantId}:{suffix}" : suffix;

    public Task<string> GetVersionAsync(string? tenantId = null, CancellationToken ct = default)
        => Task.FromResult("0");

    public Task<long> BumpVersionAsync(string? tenantId = null, CancellationToken ct = default)
        => Task.FromResult(0L);

    public Task<string> ResolveKeyAsync(string key, CancellationToken ct = default)
        => Task.FromResult(key);

    public Task<T> GetOrSetCacheAsync<T>(string key, Func<Task<T>> fetchFunction, int ttlSeconds = 3600, CancellationToken ct = default)
        => fetchFunction();

    public Task ClearCacheForSetorAsync(string? id, string? tenantId = null, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task ClearCacheForFuncionariosAsync(string? tenantId = null, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task ClearCacheForDivisoesAsync(string? tenantId = null, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task ClearCacheForCoordChangeAsync(string? tenantId, CancellationToken ct = default)
        => Task.CompletedTask;
}
