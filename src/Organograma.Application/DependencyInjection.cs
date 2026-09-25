using Organograma.Application.Auth;
using Organograma.Application.Branding;
using Organograma.Application.CargosComissionados;
using Organograma.Application.Dashboard;
using Organograma.Application.Funcionarios;
using Organograma.Application.Options;
using Organograma.Application.Referencias;
using Organograma.Application.Search;
using Organograma.Application.Setores;
using Organograma.Application.Tenants;
using Organograma.Application.Users;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Organograma.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        BindNestEnv(services, configuration);

        services.AddSingleton<BrandingPolicyService>();
        services.AddScoped<AuthService>();
        services.AddScoped<UserService>();
        services.AddScoped<TenantsService>();
        services.AddScoped<SetoresService>();
        services.AddScoped<CargosComissionadosService>();
        services.AddScoped<LimiteService>();
        services.AddScoped<FuncionariosService>();
        services.AddScoped<RelatorioService>();
        services.AddScoped<ReferenciasService>();
        services.AddScoped<SearchService>();
        services.AddScoped<DashboardService>();

        return services;
    }

    /// <summary>
    /// Maps Nest-style flat env vars (JWT_SECRET, MONGO_CONNECTING_FUNCIONARIOS, …)
    /// into strongly-typed options sections.
    /// </summary>
    private static void BindNestEnv(IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<MongoOptions>(o =>
        {
            configuration.GetSection(MongoOptions.SectionName).Bind(o);
            var conn = configuration["MONGO_CONNECTING_FUNCIONARIOS"]
                       ?? configuration["MONGO_CONNECTING_USUARIOS"]
                       ?? o.ConnectionString;
            o.ConnectionString = conn;
            try
            {
                var url = new MongoDB.Driver.MongoUrl(conn);
                if (!string.IsNullOrEmpty(url.DatabaseName))
                    o.DatabaseName = url.DatabaseName;
            }
            catch
            {
                // keep default
            }
        });

        services.Configure<JwtOptions>(o =>
        {
            configuration.GetSection(JwtOptions.SectionName).Bind(o);
            o.Secret = configuration["JWT_SECRET"] ?? o.Secret;
            o.ExpiresIn = configuration["JWT_EXPIRES_IN"] ?? o.ExpiresIn;
        });

        services.Configure<RedisOptions>(o =>
        {
            configuration.GetSection(RedisOptions.SectionName).Bind(o);
            o.Url = configuration["REDIS_URL"] ?? o.Url;
        });

        services.Configure<AwsOptions>(o =>
        {
            configuration.GetSection(AwsOptions.SectionName).Bind(o);
            o.AccessKeyId = configuration["AWS_ACCESS_KEY_ID"] ?? o.AccessKeyId;
            o.SecretAccessKey = configuration["AWS_SECRET_ACCESS_KEY"] ?? o.SecretAccessKey;
            o.Region = configuration["AWS_REGION"] ?? o.Region;
            o.BucketName = configuration["S3_BUCKET_NAME"] ?? o.BucketName;
        });

        services.Configure<CorsAppOptions>(o =>
        {
            configuration.GetSection(CorsAppOptions.SectionName).Bind(o);
            o.BaseDomain = configuration["BASE_DOMAIN"] ?? o.BaseDomain;
            o.Origins = configuration["CORS_ORIGINS"] ?? o.Origins;
        });

        services.Configure<BrandingPolicyOptions>(o =>
        {
            configuration.GetSection(BrandingPolicyOptions.SectionName).Bind(o);
            if (configuration["TENANT_CUSTOM_CSS_ENABLED"] is { } cssEnabled)
                o.CustomCssEnabled = !string.Equals(cssEnabled, "false", StringComparison.OrdinalIgnoreCase);
            if (int.TryParse(configuration["TENANT_CUSTOM_CSS_MAX_LENGTH"], out var maxLen))
                o.CustomCssMaxLength = maxLen;
            o.EditableFields = configuration["TENANT_BRANDING_EDITABLE_FIELDS"] ?? o.EditableFields;
            o.AllowedSelectors = configuration["TENANT_CUSTOM_CSS_ALLOWED_SELECTORS"] ?? o.AllowedSelectors;
            o.FontUrlHosts = configuration["TENANT_FONT_URL_HOSTS"] ?? o.FontUrlHosts;
            if (int.TryParse(configuration["TENANT_BRANDING_ASSET_MAX_BYTES"], out var maxBytes))
                o.BrandingAssetMaxBytes = maxBytes;
        });

        services.Configure<AppHostOptions>(o =>
        {
            configuration.GetSection(AppHostOptions.SectionName).Bind(o);
            o.NodeEnv = configuration["NODE_ENV"] ?? o.NodeEnv;
            if (int.TryParse(configuration["PORT"], out var port)) o.Port = port;
            if (int.TryParse(configuration["RATE_LIMIT_MAX"], out var rate)) o.RateLimitMax = rate;
        });
    }
}
