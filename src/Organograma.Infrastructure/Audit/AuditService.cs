using System.Text.Json;
using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using Organograma.Infrastructure.Persistence;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Audit;

/// <summary>Ports Nest <c>modules/audit/audit.service.ts</c> — writes to <c>auditlogs</c>.</summary>
public sealed class AuditService(MongoDbContext db, ILogger<AuditService> logger) : IAuditService
{
    public async Task LogActionAsync(
        string? tenantId,
        string? userId,
        string action,
        string entity,
        object? entityId,
        object? meta = null,
        CancellationToken ct = default)
    {
        try
        {
            var now = DateTime.UtcNow;
            var doc = new AuditLog
            {
                Id = ObjectId.GenerateNewId(),
                TenantId = TenantHelpers.ToObjectId(tenantId),
                UserId = TenantHelpers.ToObjectId(userId),
                Action = action,
                Entity = entity,
                EntityId = entityId is null ? null : Convert.ToString(entityId),
                Meta = ToMetaDocument(meta),
                CreatedAt = now,
                UpdatedAt = now,
            };
            await db.AuditLogs.InsertOneAsync(doc, cancellationToken: ct);
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Falha ao gravar audit log: {Message} action={Action} entity={Entity}",
                ex.Message,
                action,
                entity);
        }
    }

    public async Task<AuditListResult> ListAsync(
        string? tenantId,
        int limit = 50,
        int skip = 0,
        bool isSuperadmin = false,
        CancellationToken ct = default)
    {
        var filterDoc = !isSuperadmin && !string.IsNullOrWhiteSpace(tenantId)
            ? TenantHelpers.TenantFilter(tenantId)
            : new BsonDocument();

        var safeLimit = Math.Min(limit, 200);
        var filter = new BsonDocumentFilterDefinition<AuditLog>(filterDoc);

        var itemsTask = db.AuditLogs
            .Find(filter)
            .SortByDescending(a => a.CreatedAt)
            .Skip(skip)
            .Limit(safeLimit)
            .ToListAsync(ct);
        var totalTask = db.AuditLogs.CountDocumentsAsync(filter, cancellationToken: ct);
        await Task.WhenAll(itemsTask, totalTask);

        var items = await itemsTask;
        var total = await totalTask;

        var userIds = items
            .Where(i => i.UserId is not null)
            .Select(i => i.UserId!.Value)
            .Distinct()
            .ToList();

        var userMap = new Dictionary<string, string>();
        if (userIds.Count > 0)
        {
            try
            {
                var users = await db.Users
                    .Find(Builders<User>.Filter.In(u => u.Id, userIds))
                    .Project(u => new { u.Id, u.Username, u.LoginId })
                    .ToListAsync(ct);
                foreach (var u in users)
                {
                    userMap[u.Id.ToString()] = string.IsNullOrEmpty(u.Username)
                        ? (u.LoginId ?? "usuário")
                        : u.Username;
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Falha ao enriquecer audit com usuários: {Message}", ex.Message);
            }
        }

        var enriched = items.Select(item => (object)new Dictionary<string, object?>
        {
            ["_id"] = item.Id.ToString(),
            ["tenantId"] = item.TenantId?.ToString(),
            ["userId"] = item.UserId?.ToString(),
            ["action"] = item.Action,
            ["entity"] = item.Entity,
            ["entityId"] = item.EntityId,
            ["meta"] = BsonToPlain(item.Meta),
            ["createdAt"] = item.CreatedAt,
            ["updatedAt"] = item.UpdatedAt,
            ["username"] = item.UserId is null
                ? null
                : userMap.GetValueOrDefault(item.UserId.Value.ToString()),
        }).ToList();

        return new AuditListResult
        {
            Items = enriched,
            Total = total,
            Limit = safeLimit,
            Skip = skip,
        };
    }

    private static BsonDocument ToMetaDocument(object? meta)
    {
        if (meta is null) return new BsonDocument();
        if (meta is BsonDocument bd) return bd;
        try
        {
            var json = JsonSerializer.Serialize(meta);
            return string.IsNullOrWhiteSpace(json) || json == "null"
                ? new BsonDocument()
                : BsonDocument.Parse(json);
        }
        catch
        {
            return new BsonDocument("value", Convert.ToString(meta) ?? "");
        }
    }

    private static object? BsonToPlain(BsonValue? value)
    {
        if (value is null || value.IsBsonNull) return null;
        if (value.IsBsonDocument)
            return value.AsBsonDocument.Elements.ToDictionary(e => e.Name, e => BsonToPlain(e.Value));
        if (value.IsBsonArray)
            return value.AsBsonArray.Select(BsonToPlain).ToList();
        if (value.IsObjectId) return value.AsObjectId.ToString();
        if (value.IsValidDateTime) return value.ToUniversalTime();
        if (value.IsString) return value.AsString;
        if (value.IsBoolean) return value.AsBoolean;
        if (value.IsInt32) return value.AsInt32;
        if (value.IsInt64) return value.AsInt64;
        if (value.IsDouble) return value.AsDouble;
        return value.ToString();
    }
}
