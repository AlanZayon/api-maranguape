using Organograma.Application.Options;
using Microsoft.Extensions.Options;

namespace Organograma.Api.Cors;

public static class CorsConfig
{
    private static readonly string[] StaticOrigins =
    [
        "https://heroic-alfajores-da3394.netlify.app",
        "http://localhost:5174",
        "http://localhost:5173",
        "http://localhost:4200",
    ];

    public static void AddAppCors(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddCors(options =>
        {
            options.AddPolicy("AppCors", policy =>
            {
                policy.AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials()
                    .SetIsOriginAllowed(origin => IsAllowedOrigin(origin, configuration));
            });
        });
    }

    public static bool IsAllowedOrigin(string? origin, IConfiguration configuration)
    {
        if (string.IsNullOrEmpty(origin)) return true;

        var extra = (configuration["CORS_ORIGINS"] ?? configuration["Cors:Origins"] ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var allowed = StaticOrigins.Concat(extra).ToHashSet(StringComparer.Ordinal);

        if (allowed.Contains(origin)) return true;

        try
        {
            var uri = new Uri(origin);
            if (uri.Scheme is not ("http" or "https")) return false;
            var hostname = uri.Host;

            if (hostname.EndsWith(".localhost", StringComparison.Ordinal) || hostname == "localhost")
                return true;

            var baseDomain = (configuration["BASE_DOMAIN"] ?? configuration["Cors:BaseDomain"] ?? "")
                .ToLowerInvariant()
                .TrimStart('.');

            if (!string.IsNullOrEmpty(baseDomain))
            {
                if (hostname == baseDomain || hostname == $"www.{baseDomain}")
                    return true;

                var pattern = $"^[a-z0-9]([a-z0-9-]{{0,61}}[a-z0-9])?\\.{System.Text.RegularExpressions.Regex.Escape(baseDomain)}$";
                if (System.Text.RegularExpressions.Regex.IsMatch(hostname, pattern))
                    return true;
            }
        }
        catch
        {
            return false;
        }

        return false;
    }
}
