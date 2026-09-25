using Organograma.Domain.Entities;
using Organograma.Infrastructure.Persistence;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Bootstrap;

public sealed class IndexSyncHostedService(
    MongoDbContext db,
    ILogger<IndexSyncHostedService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.Funcionarios.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<Funcionario>(
                    Builders<Funcionario>.IndexKeys
                        .Ascending(f => f.TenantId)
                        .Ascending(f => f.Nome),
                    new CreateIndexOptions { Unique = true, Name = "tenantId_1_nome_1" }),
                new CreateIndexModel<Funcionario>(
                    Builders<Funcionario>.IndexKeys
                        .Ascending(f => f.TenantId)
                        .Ascending(f => f.SetorId),
                    new CreateIndexOptions { Name = "tenantId_1_setorId_1" }),
            ], cancellationToken);

            await db.Setors.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<Setor>(
                    Builders<Setor>.IndexKeys
                        .Ascending(s => s.TenantId)
                        .Ascending(s => s.Parent),
                    new CreateIndexOptions { Name = "tenantId_1_parent_1" }),
            ], cancellationToken);

            await db.References.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<Reference>(
                    Builders<Reference>.IndexKeys
                        .Ascending(r => r.TenantId)
                        .Ascending(r => r.Name),
                    new CreateIndexOptions { Unique = true, Name = "tenantId_1_name_1" }),
                new CreateIndexModel<Reference>(
                    Builders<Reference>.IndexKeys
                        .Ascending(r => r.TenantId)
                        .Ascending(r => r.ParentId),
                    new CreateIndexOptions { Name = "tenantId_1_parentId_1" }),
            ], cancellationToken);

            await db.Users.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<User>(
                    Builders<User>.IndexKeys.Ascending(u => u.LoginId),
                    new CreateIndexOptions { Unique = true, Name = "id_1" }),
                new CreateIndexModel<User>(
                    Builders<User>.IndexKeys
                        .Ascending(u => u.TenantId)
                        .Ascending(u => u.Username),
                    new CreateIndexOptions { Unique = true, Name = "tenantId_1_username_1" }),
            ], cancellationToken);

            await db.Tenants.Indexes.CreateOneAsync(
                new CreateIndexModel<Tenant>(
                    Builders<Tenant>.IndexKeys.Ascending(t => t.Slug),
                    new CreateIndexOptions { Unique = true, Name = "slug_1" }),
                cancellationToken: cancellationToken);

            logger.LogInformation("Mongo indexes synchronized");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Index sync failed (non-fatal)");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
