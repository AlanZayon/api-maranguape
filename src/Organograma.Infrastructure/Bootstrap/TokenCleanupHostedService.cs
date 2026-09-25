using Hangfire;
using Organograma.Infrastructure.Persistence;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Bootstrap;

public sealed class TokenCleanupHostedService(
    ILogger<TokenCleanupHostedService> logger) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            RecurringJob.AddOrUpdate<TokenCleanupJob>(
                "token-cleanup",
                job => job.RunAsync(),
                Cron.Hourly);
            logger.LogInformation("Scheduled hourly token cleanup");
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Hangfire not available — token cleanup not scheduled");
        }

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

public sealed class TokenCleanupJob(MongoDbContext db, ILogger<TokenCleanupJob> logger)
{
    public async Task RunAsync()
    {
        var now = DateTime.UtcNow;
        var filter = Builders<Domain.Entities.User>.Filter.And(
            Builders<Domain.Entities.User>.Filter.Ne(u => u.TokenExpiresAt, null),
            Builders<Domain.Entities.User>.Filter.Lt(u => u.TokenExpiresAt, now));

        var update = Builders<Domain.Entities.User>.Update
            .Set(u => u.LastValidToken, null)
            .Set(u => u.TokenExpiresAt, null);

        var result = await db.Users.UpdateManyAsync(filter, update);
        if (result.ModifiedCount > 0)
            logger.LogInformation("Cleared {Count} expired tokens", result.ModifiedCount);
    }
}
