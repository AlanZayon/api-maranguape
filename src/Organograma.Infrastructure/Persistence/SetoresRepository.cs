using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Persistence;

public sealed class SetoresRepository(MongoDbContext db) : ISetoresRepository
{
    public async Task<IReadOnlyList<Setor>> GetAllAsync(string? tenantId, CancellationToken ct = default)
    {
        var filter = new BsonDocumentFilterDefinition<Setor>(TenantHelpers.TenantFilter(tenantId));
        return await db.Setors.Find(filter).ToListAsync(ct);
    }

    public Task<Setor?> FindByIdAsync(string id, string? tenantId, CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return Task.FromResult<Setor?>(null);
        var filter = Builders<Setor>.Filter.Eq(s => s.Id, oid)
                     & new BsonDocumentFilterDefinition<Setor>(TenantHelpers.TenantFilter(tenantId));
        return db.Setors.Find(filter).FirstOrDefaultAsync(ct)!;
    }

    public async Task<Setor> CreateAsync(Setor setor, CancellationToken ct = default)
    {
        if (setor.Id == ObjectId.Empty) setor.Id = ObjectId.GenerateNewId();
        if (setor.CreatedAt == default) setor.CreatedAt = DateTime.UtcNow;
        await db.Setors.InsertOneAsync(setor, cancellationToken: ct);
        return setor;
    }

    public async Task<IReadOnlyList<Setor>> FindMainSetoresAsync(string? tenantId, CancellationToken ct = default)
    {
        var filter = Builders<Setor>.Filter.Eq(s => s.Parent, null)
                     & new BsonDocumentFilterDefinition<Setor>(TenantHelpers.TenantFilter(tenantId));
        return await db.Setors.Find(filter).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Setor>> FindChildrenAsync(
        string? parentId,
        string? tenantId,
        CancellationToken ct = default)
    {
        FilterDefinition<Setor> parentFilter;
        if (string.IsNullOrEmpty(parentId))
        {
            parentFilter = Builders<Setor>.Filter.Eq(s => s.Parent, null);
        }
        else
        {
            var values = TenantHelpers.IdMatchValues(parentId)
                .Select(v => v is ObjectId oid ? (BsonValue)oid : (BsonValue)Convert.ToString(v)!)
                .ToList();
            parentFilter = new BsonDocumentFilterDefinition<Setor>(
                new BsonDocument("parent", new BsonDocument("$in", new BsonArray(values))));
        }

        var filter = parentFilter
                     & new BsonDocumentFilterDefinition<Setor>(TenantHelpers.TenantFilter(tenantId));
        return await db.Setors.Find(filter).ToListAsync(ct);
    }

    public Task<IReadOnlyList<Setor>> FindSetorDataAsync(string setorId, string? tenantId, CancellationToken ct = default)
        => FindChildrenAsync(setorId, tenantId, ct);

    public async Task<Setor?> UpdateNomeAsync(
        string id,
        string nome,
        ObjectId? updatedBy,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return null;
        var filter = Builders<Setor>.Filter.Eq(s => s.Id, oid)
                     & new BsonDocumentFilterDefinition<Setor>(TenantHelpers.TenantFilter(tenantId));
        var update = Builders<Setor>.Update.Set(s => s.Nome, nome);
        if (updatedBy is not null)
            update = update.Set(s => s.UpdatedBy, updatedBy);
        return await db.Setors.FindOneAndUpdateAsync(
            filter,
            update,
            new FindOneAndUpdateOptions<Setor> { ReturnDocument = ReturnDocument.After },
            ct);
    }

    public async Task<Setor?> UpdateParentAsync(
        string id,
        ObjectId? parent,
        ObjectId? updatedBy,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return null;
        var filter = Builders<Setor>.Filter.Eq(s => s.Id, oid)
                     & new BsonDocumentFilterDefinition<Setor>(TenantHelpers.TenantFilter(tenantId));
        var update = Builders<Setor>.Update.Set(s => s.Parent, parent);
        if (updatedBy is not null)
            update = update.Set(s => s.UpdatedBy, updatedBy);
        return await db.Setors.FindOneAndUpdateAsync(
            filter,
            update,
            new FindOneAndUpdateOptions<Setor> { ReturnDocument = ReturnDocument.After },
            ct);
    }

    public async Task<IReadOnlyList<ObjectId>> GetDescendantIdsAsync(
        string id,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var objectId)) return [];

        var seen = new HashSet<string> { objectId.ToString() };
        var frontier = new List<ObjectId> { objectId };
        var tenantFilter = TenantHelpers.TenantFilter(tenantId);

        while (frontier.Count > 0)
        {
            var matchIds = new BsonArray();
            foreach (var fid in frontier)
            {
                matchIds.Add(fid);
                matchIds.Add(fid.ToString());
            }

            var filterDoc = new BsonDocument("parent", new BsonDocument("$in", matchIds));
            foreach (var el in tenantFilter.Elements)
                filterDoc[el.Name] = el.Value;

            var children = await db.Setors
                .Find(new BsonDocumentFilterDefinition<Setor>(filterDoc))
                .Project(s => s.Id)
                .ToListAsync(ct);

            var next = new List<ObjectId>();
            foreach (var childId in children)
            {
                var key = childId.ToString();
                if (!seen.Add(key)) continue;
                next.Add(childId);
            }
            frontier = next;
        }

        return seen
            .Where(s => ObjectId.TryParse(s, out _))
            .Select(ObjectId.Parse)
            .ToList();
    }

    public async Task<long> DeleteWithChildrenAsync(string id, string? tenantId, CancellationToken ct = default)
    {
        var ids = await GetDescendantIdsAsync(id, tenantId, ct);
        if (ids.Count == 0) return 0;
        var filter = Builders<Setor>.Filter.In(s => s.Id, ids)
                     & new BsonDocumentFilterDefinition<Setor>(TenantHelpers.TenantFilter(tenantId));
        var result = await db.Setors.DeleteManyAsync(filter, ct);
        return result.DeletedCount;
    }

    public async Task<Dictionary<string, int>> CountFuncionariosPorSetorAsync(
        string? tenantId,
        CancellationToken ct = default)
    {
        var pipeline = new List<BsonDocument>();
        var tenantFilter = TenantHelpers.TenantFilter(tenantId);
        if (tenantFilter.ElementCount > 0)
            pipeline.Add(new BsonDocument("$match", tenantFilter));
        pipeline.Add(new BsonDocument("$group", new BsonDocument
        {
            { "_id", "$setorId" },
            { "total", new BsonDocument("$sum", 1) },
        }));

        var result = await db.Funcionarios
            .Aggregate<BsonDocument>(pipeline)
            .ToListAsync(ct);

        var map = new Dictionary<string, int>();
        foreach (var doc in result)
        {
            if (doc.TryGetValue("_id", out var idVal) && idVal != BsonNull.Value)
                map[idVal.ToString()!] = doc["total"].ToInt32();
        }
        return map;
    }

    public Task<long> CountFuncionariosInSetoresAsync(
        IReadOnlyList<ObjectId> setorIds,
        CancellationToken ct = default)
    {
        var values = new BsonArray();
        foreach (var id in setorIds)
        {
            values.Add(id);
            values.Add(id.ToString());
        }
        var filter = new BsonDocument("setorId", new BsonDocument("$in", values));
        return db.Funcionarios.CountDocumentsAsync(
            new BsonDocumentFilterDefinition<Funcionario>(filter),
            cancellationToken: ct);
    }
}
