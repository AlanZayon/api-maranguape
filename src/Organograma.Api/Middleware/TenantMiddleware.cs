using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Organograma.Api.Auth;
using Organograma.Application.Options;
using Organograma.Domain;
using Organograma.Infrastructure.Persistence;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;

namespace Organograma.Api.Middleware;

public sealed class TenantMiddleware(RequestDelegate next)
{
    private static readonly ConcurrentDictionary<string, (object Tenant, long ExpiresAt)> SlugCache = new();
    private const long SlugTtlMs = 60_000;

    public async Task InvokeAsync(
        HttpContext context,
        IOptions<JwtOptions> jwtOptions,
        IOptions<CorsAppOptions> corsOptions,
        MongoDbContext db)
    {
        if (context.Request.Cookies.TryGetValue("authToken", out var token)
            && !string.IsNullOrEmpty(token)
            && !string.IsNullOrEmpty(jwtOptions.Value.Secret))
        {
            try
            {
                var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
                var principal = handler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Value.Secret)),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                }, out _);

                var jwtTenant = principal.FindFirst("tenantId")?.Value;
                if (!string.IsNullOrEmpty(jwtTenant))
                {
                    context.Items[HttpContextKeys.TenantId] = jwtTenant;
                    await next(context);
                    return;
                }
            }
            catch
            {
                // fall through
            }
        }

        var slug = ResolveSlugFromRequest(context, corsOptions.Value.BaseDomain);
        if (string.IsNullOrEmpty(slug) || TenantHelpers.IsReservedSubdomain(slug))
        {
            await next(context);
            return;
        }

        var tenant = await FindTenantBySlugAsync(db, slug, context.RequestAborted);
        if (tenant is not null)
        {
            context.Items[HttpContextKeys.Tenant] = tenant;
            context.Items[HttpContextKeys.TenantId] = tenant.Id.ToString();
        }

        await next(context);
    }

    private static string? ResolveSlugFromRequest(HttpContext context, string baseDomain)
    {
        if (context.Request.Headers.TryGetValue("X-Tenant-Slug", out var rawSlug)
            && !string.IsNullOrWhiteSpace(rawSlug))
        {
            return rawSlug.ToString().ToLowerInvariant().Trim();
        }

        var hostHeader = context.Request.Headers["X-Forwarded-Host"].FirstOrDefault()
                         ?? context.Request.Host.Value
                         ?? "";
        var origin = context.Request.Headers.Origin.FirstOrDefault() ?? "";
        var hostname = hostHeader.Split(',')[0].Trim();
        if (!string.IsNullOrEmpty(origin) && Uri.TryCreate(origin, UriKind.Absolute, out var originUri))
            hostname = originUri.Host;

        return TenantHelpers.ExtractSubdomain(hostname, baseDomain ?? "");
    }

    private static async Task<Domain.Entities.Tenant?> FindTenantBySlugAsync(
        MongoDbContext db,
        string slug,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (SlugCache.TryGetValue(slug, out var cached) && cached.ExpiresAt > now)
            return cached.Tenant as Domain.Entities.Tenant;

        var tenant = await db.Tenants
            .Find(t => t.Slug == slug && t.Status == "active")
            .FirstOrDefaultAsync(ct);

        if (tenant is not null)
            SlugCache[slug] = (tenant, now + SlugTtlMs);
        else
            SlugCache.TryRemove(slug, out _);

        return tenant;
    }
}
