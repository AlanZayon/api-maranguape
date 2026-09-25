using Hangfire;
using Hangfire.Server;
using Organograma.Application.Abstractions;
using Organograma.Application.Funcionarios;
using Organograma.Infrastructure.Persistence;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Jobs;

public sealed class BulkJobService(MongoDbContext db) : IBulkJobService
{
    public async Task<object> EnqueueDeleteUsersAsync(
        IReadOnlyList<string> userIds,
        string? tenantId,
        CancellationToken ct = default)
    {
        var jobId = BackgroundJob.Enqueue<BulkFuncionariosJobs>(
            j => j.DeleteUsersAsync(null!, userIds.ToList(), tenantId));
        await UpsertStatusAsync(jobId, "delete-users", "queued", null, null, ct);
        return new { jobId, status = "queued" };
    }

    public async Task<object> EnqueueExportCsvAsync(
        IReadOnlyList<string> ids,
        string? tenantId,
        CancellationToken ct = default)
    {
        var jobId = BackgroundJob.Enqueue<BulkFuncionariosJobs>(
            j => j.ExportCsvAsync(null!, ids.ToList(), tenantId));
        await UpsertStatusAsync(jobId, "export-csv", "queued", null, null, ct);
        return new { jobId, status = "queued" };
    }

    public async Task<BulkJobStatusDto?> GetJobStatusAsync(string jobId, CancellationToken ct = default)
    {
        var doc = await db.BulkJobs.Find(Builders<BsonDocument>.Filter.Eq("_id", jobId))
            .FirstOrDefaultAsync(ct);
        if (doc is null) return null;

        object? result = null;
        if (doc.TryGetValue("result", out var r) && r is not null && !r.IsBsonNull)
        {
            if (r.IsBsonDocument)
                result = BsonTypeMapper.MapToDotNetValue(r);
            else
                result = BsonTypeMapper.MapToDotNetValue(r);
        }

        return new BulkJobStatusDto
        {
            JobId = jobId,
            Name = doc.GetValue("name", "").AsString,
            Status = doc.GetValue("status", "queued").AsString,
            Progress = doc.TryGetValue("progress", out var p) ? BsonTypeMapper.MapToDotNetValue(p)! : 0,
            Result = result,
            Error = doc.TryGetValue("error", out var e) && !e.IsBsonNull ? e.AsString : null,
        };
    }

    public Task MarkActiveAsync(string jobId, CancellationToken ct = default)
        => UpsertStatusAsync(jobId, null, "active", 10, null, ct);

    public async Task MarkCompletedAsync(string jobId, object result, CancellationToken ct = default)
    {
        var bson = result switch
        {
            BsonValue bv => bv,
            _ => BsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(result)),
        };
        await UpsertStatusAsync(jobId, null, "completed", 100, bson, ct, error: null);
    }

    public Task MarkFailedAsync(string jobId, string error, CancellationToken ct = default)
        => UpsertStatusAsync(jobId, null, "failed", null, null, ct, error);

    private async Task UpsertStatusAsync(
        string jobId,
        string? name,
        string status,
        object? progress,
        BsonValue? result,
        CancellationToken ct,
        string? error = null)
    {
        var set = new BsonDocument
        {
            ["status"] = status,
            ["updatedAt"] = DateTime.UtcNow,
        };
        if (name is not null) set["name"] = name;
        if (progress is not null) set["progress"] = BsonValue.Create(progress);
        if (result is not null) set["result"] = result;
        if (error is not null) set["error"] = error;

        await db.BulkJobs.UpdateOneAsync(
            Builders<BsonDocument>.Filter.Eq("_id", jobId),
            new BsonDocument
            {
                ["$set"] = set,
                ["$setOnInsert"] = new BsonDocument
                {
                    ["_id"] = jobId,
                    ["createdAt"] = DateTime.UtcNow,
                },
            },
            new UpdateOptions { IsUpsert = true },
            ct);
    }
}

public sealed class BulkFuncionariosJobs(
    FuncionariosService funcionariosService,
    BulkJobService bulkJobService)
{
    public async Task DeleteUsersAsync(PerformContext context, List<string> userIds, string? tenantId)
    {
        var jobId = context.BackgroundJob.Id;
        try
        {
            await bulkJobService.MarkActiveAsync(jobId);
            await funcionariosService.DeleteUsersAsync(userIds, tenantId);
            await bulkJobService.MarkCompletedAsync(jobId, new { deleted = userIds.Count });
        }
        catch (Exception ex)
        {
            await bulkJobService.MarkFailedAsync(jobId, ex.Message);
            throw;
        }
    }

    public async Task ExportCsvAsync(PerformContext context, List<string> ids, string? tenantId)
    {
        var jobId = context.BackgroundJob.Id;
        try
        {
            await bulkJobService.MarkActiveAsync(jobId);
            var csv = await funcionariosService.ExportCsvAsync(tenantId, ids);
            await bulkJobService.MarkCompletedAsync(jobId, new { csv, count = ids.Count });
        }
        catch (Exception ex)
        {
            await bulkJobService.MarkFailedAsync(jobId, ex.Message);
            throw;
        }
    }
}
