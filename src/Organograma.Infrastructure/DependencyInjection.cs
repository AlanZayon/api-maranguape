using Hangfire;
using Hangfire.Mongo;
using Hangfire.Mongo.Migration.Strategies;
using Hangfire.Mongo.Migration.Strategies.Backup;
using Organograma.Application.Abstractions;
using Organograma.Application.Options;
using Organograma.Infrastructure.Audit;
using Organograma.Infrastructure.Cache;
using Organograma.Infrastructure.Persistence;
using Organograma.Infrastructure.S3;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using StackExchange.Redis;

namespace Organograma.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<MongoDbContext>();
        services.AddHostedService<Bootstrap.IndexSyncHostedService>();
        services.AddHostedService<Bootstrap.TokenCleanupHostedService>();
        services.AddScoped<Bootstrap.TokenCleanupJob>();
        services.AddScoped<IAuthRepository, AuthRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<ITenantsRepository, TenantsRepository>();
        services.AddScoped<ISetoresRepository, SetoresRepository>();
        services.AddScoped<ICargosComissionadosRepository, CargosComissionadosRepository>();
        services.AddScoped<IFuncionariosRepository, FuncionariosRepository>();
        services.AddScoped<IReferenceLookup, ReferenceLookup>();
        services.AddScoped<IReferenciasRepository, ReferenciasRepository>();
        services.AddScoped<ISearchRepository, SearchRepository>();
        services.AddScoped<IDashboardRepository, DashboardRepository>();
        services.AddScoped<IBulkJobService, Jobs.BulkJobService>();
        services.AddScoped<Jobs.BulkJobService>();
        services.AddScoped<Jobs.BulkFuncionariosJobs>();
        services.AddScoped<IAuditService, Audit.AuditService>();

        services.AddSingleton<IS3Service>(sp =>
        {
            var aws = sp.GetRequiredService<IOptions<AwsOptions>>().Value;
            if (string.IsNullOrWhiteSpace(aws.AccessKeyId) || string.IsNullOrWhiteSpace(aws.BucketName))
                return new NullS3Service();
            return ActivatorUtilities.CreateInstance<S3Service>(sp);
        });

        services.AddSingleton<ICacheService>(sp =>
        {
            var redis = sp.GetRequiredService<IOptions<RedisOptions>>().Value;
            var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Redis");
            try
            {
                var mux = ConnectionMultiplexer.Connect(ParseRedis(redis.Url));
                return new CacheService(mux, sp.GetRequiredService<ILogger<CacheService>>());
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Redis unavailable — using null cache");
                return new NullCacheService();
            }
        });

        // Hangfire.Mongo — skip under tests (DISABLE_HANGFIRE / Testing) so Host.StartAsync does not block
        var envName = configuration["ASPNETCORE_ENVIRONMENT"]
                      ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var disableHangfire =
            string.Equals(configuration["DISABLE_HANGFIRE"], "true", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Environment.GetEnvironmentVariable("DISABLE_HANGFIRE"), "true", StringComparison.OrdinalIgnoreCase)
            || string.Equals(envName, "Testing", StringComparison.OrdinalIgnoreCase);

        if (!disableHangfire)
        {
            var mongoConn = configuration["MONGO_CONNECTING_FUNCIONARIOS"]
                            ?? configuration["Mongo:ConnectionString"]
                            ?? "mongodb://localhost:27017/funcionarios";
            try
            {
                var mongoUrl = new MongoUrl(mongoConn);
                var dbName = mongoUrl.DatabaseName ?? "funcionarios";
                services.AddHangfire(config => config
                    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
                    .UseSimpleAssemblyNameTypeSerializer()
                    .UseRecommendedSerializerSettings()
                    .UseMongoStorage(mongoConn, dbName, new MongoStorageOptions
                    {
                        MigrationOptions = new MongoMigrationOptions
                        {
                            MigrationStrategy = new MigrateMongoMigrationStrategy(),
                            BackupStrategy = new CollectionMongoBackupStrategy(),
                        },
                        CheckConnection = false,
                    }));
                services.AddHangfireServer(options =>
                {
                    options.ServerName = $"organograma-{Environment.MachineName}";
                    options.WorkerCount = 1;
                });
            }
            catch
            {
                // Hangfire optional at bootstrap if Mongo URL is invalid
            }
        }

        return services;
    }

    private static ConfigurationOptions ParseRedis(string url)
    {
        if (url.StartsWith("redis://", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
        {
            var uri = new Uri(url);
            var opts = new ConfigurationOptions
            {
                AbortOnConnectFail = false,
                ConnectTimeout = 2000,
            };
            opts.EndPoints.Add(uri.Host, uri.Port > 0 ? uri.Port : 6379);
            if (!string.IsNullOrEmpty(uri.UserInfo))
            {
                var parts = uri.UserInfo.Split(':', 2);
                if (parts.Length == 2) opts.Password = Uri.UnescapeDataString(parts[1]);
            }
            return opts;
        }

        return ConfigurationOptions.Parse(url);
    }
}
