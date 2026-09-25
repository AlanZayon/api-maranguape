using System.Text.RegularExpressions;
using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Persistence;

public sealed class ReferenciasRepository(MongoDbContext db) : IReferenciasRepository
{
    private static readonly BsonDocument ReferenceFields = new()
    {
        { "name", 1 },
        { "cargo", 1 },
        { "telefone", 1 },
        { "origem", 1 },
        { "funcionarioId", 1 },
        { "parentId", 1 },
    };

    private static readonly BsonDocument NestedReferenceFields = new()
    {
        { "_id", 1 },
        { "name", 1 },
        { "cargo", 1 },
        { "telefone", 1 },
        { "origem", 1 },
        { "funcionarioId", 1 },
        { "parentId", 1 },
        { "depth", 1 },
    };

    private static readonly ProjectionDefinition<Funcionario> FuncionarioProjection =
        Builders<Funcionario>.Projection
            .Include(f => f.Nome)
            .Include(f => f.Funcao)
            .Include(f => f.Secretaria)
            .Include(f => f.Natureza)
            .Include(f => f.ReferenciaId);

    public string CacheKeyFor(string? tenantId)
        => TenantHelpers.CacheKey(tenantId, "referencias-dados");

    public string TreeCacheKeyFor(string? tenantId)
        => TenantHelpers.CacheKey(tenantId, "referencias-arvore");

    public Task<Reference?> FindReferenceByNameAsync(string name, string? tenantId, CancellationToken ct = default)
    {
        var filter = Builders<Reference>.Filter.Eq(r => r.Name, name)
                     & new BsonDocumentFilterDefinition<Reference>(TenantHelpers.TenantFilter(tenantId));
        return db.References.Find(filter).FirstOrDefaultAsync(ct)!;
    }

    public Task<Reference?> FindReferenceByFuncionarioIdAsync(
        string funcionarioId,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(funcionarioId, out var oid))
            return Task.FromResult<Reference?>(null);

        var filter = Builders<Reference>.Filter.Eq(r => r.FuncionarioId, oid)
                     & new BsonDocumentFilterDefinition<Reference>(TenantHelpers.TenantFilter(tenantId));
        return db.References.Find(filter).FirstOrDefaultAsync(ct)!;
    }

    public Task<Reference?> FindReferenceByIdAsync(string id, string? tenantId, CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid))
            return Task.FromResult<Reference?>(null);

        var filter = Builders<Reference>.Filter.Eq(r => r.Id, oid)
                     & new BsonDocumentFilterDefinition<Reference>(TenantHelpers.TenantFilter(tenantId));
        return db.References.Find(filter).FirstOrDefaultAsync(ct)!;
    }

    public async Task<Reference> CreateReferenceAsync(Reference reference, CancellationToken ct = default)
    {
        if (reference.Id == ObjectId.Empty)
            reference.Id = ObjectId.GenerateNewId();
        // FuncionarioId is BsonIgnoreIfNull — omitted for origem=externa (partial unique index).
        await db.References.InsertOneAsync(reference, cancellationToken: ct);
        return reference;
    }

    public async Task<IReadOnlyList<Reference>> GetAllReferencesAsync(string? tenantId, CancellationToken ct = default)
    {
        var filter = new BsonDocumentFilterDefinition<Reference>(TenantHelpers.TenantFilter(tenantId));
        return await db.References.Find(filter).SortBy(r => r.Name).ToListAsync(ct);
    }

    public async Task<Reference?> UpdateReferenceByIdAsync(
        string id,
        BsonDocument setFields,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return null;
        var filter = Builders<Reference>.Filter.Eq(r => r.Id, oid)
                     & new BsonDocumentFilterDefinition<Reference>(TenantHelpers.TenantFilter(tenantId));
        return await db.References.FindOneAndUpdateAsync(
            filter,
            new BsonDocument("$set", setFields),
            new FindOneAndUpdateOptions<Reference> { ReturnDocument = ReturnDocument.After },
            ct);
    }

    public async Task<Reference?> DeleteReferenceByIdAsync(
        string id,
        string? tenantId,
        IClientSessionHandle? session = null,
        CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return null;
        var filter = Builders<Reference>.Filter.Eq(r => r.Id, oid)
                     & new BsonDocumentFilterDefinition<Reference>(TenantHelpers.TenantFilter(tenantId));

        if (session is not null)
            return await db.References.FindOneAndDeleteAsync(session, filter, cancellationToken: ct);
        return await db.References.FindOneAndDeleteAsync(filter, cancellationToken: ct);
    }

    public async Task<IReadOnlyList<ReferenceNode>> FindAncestorsAsync(
        string id,
        string? tenantId,
        CancellationToken ct = default)
    {
        var oid = TenantHelpers.ToObjectId(id);
        if (oid is null) return [];

        var scope = TenantHelpers.TenantFilter(tenantId);
        var match = new BsonDocument("_id", oid.Value);
        foreach (var el in scope.Elements)
            match[el.Name] = el.Value;

        var graphLookup = new BsonDocument
        {
            { "from", MongoDbContext.ReferencesCollection },
            { "startWith", "$parentId" },
            { "connectFromField", "parentId" },
            { "connectToField", "_id" },
            { "as", "ancestors" },
            { "depthField", "depth" },
        };
        if (scope.ElementCount > 0)
            graphLookup["restrictSearchWithMatch"] = scope;

        var pipeline = new[]
        {
            new BsonDocument("$match", match),
            new BsonDocument("$graphLookup", graphLookup),
            new BsonDocument("$project", new BsonDocument("ancestors", NestedReferenceFields)),
        };

        var result = await db.References.Aggregate<BsonDocument>(pipeline).FirstOrDefaultAsync(ct);
        if (result is null) return [];

        var ancestors = result.GetValue("ancestors", new BsonArray()).AsBsonArray
            .Select(ParseReferenceNode)
            .OrderByDescending(a => a.Depth ?? 0)
            .ToList();

        return ancestors;
    }

    public async Task<(ReferenceNode? Root, IReadOnlyList<ReferenceNode> Referencias, IReadOnlyList<FuncionarioTreeNode> Funcionarios)>
        FindDescendantsAsync(string id, string? tenantId, CancellationToken ct = default)
    {
        var oid = TenantHelpers.ToObjectId(id);
        if (oid is null)
            return (null, [], []);

        var scope = TenantHelpers.TenantFilter(tenantId);
        var match = new BsonDocument("_id", oid.Value);
        foreach (var el in scope.Elements)
            match[el.Name] = el.Value;

        var graphLookup = new BsonDocument
        {
            { "from", MongoDbContext.ReferencesCollection },
            { "startWith", "$_id" },
            { "connectFromField", "_id" },
            { "connectToField", "parentId" },
            { "as", "descendants" },
            { "depthField", "depth" },
        };
        if (scope.ElementCount > 0)
            graphLookup["restrictSearchWithMatch"] = scope;

        var project = new BsonDocument(ReferenceFields)
        {
            { "descendants", NestedReferenceFields },
        };

        var pipeline = new[]
        {
            new BsonDocument("$match", match),
            new BsonDocument("$graphLookup", graphLookup),
            new BsonDocument("$project", project),
        };

        var result = await db.References.Aggregate<BsonDocument>(pipeline).FirstOrDefaultAsync(ct);
        if (result is null)
            return (null, [], []);

        var descendants = result.GetValue("descendants", new BsonArray()).AsBsonArray
            .Select(ParseReferenceNode)
            .ToList();

        var rootDoc = new BsonDocument(result);
        rootDoc.Remove("descendants");
        var root = ParseReferenceNode(rootDoc);

        var subtreeIds = new List<ObjectId> { root.Id };
        subtreeIds.AddRange(descendants.Select(d => d.Id));

        var funcionarios = await FindFuncionariosByReferenciaIdsAsync(subtreeIds, tenantId, ct);
        return (root, descendants, funcionarios);
    }

    public async Task<(IReadOnlyList<ReferenceNode> Referencias, IReadOnlyList<FuncionarioTreeNode> Funcionarios)>
        FindAllForTreeAsync(string? tenantId, CancellationToken ct = default)
    {
        var scope = new BsonDocumentFilterDefinition<Reference>(TenantHelpers.TenantFilter(tenantId));
        var funcScope = new BsonDocument
        {
            { "referenciaId", new BsonDocument("$ne", BsonNull.Value) },
        };
        foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
            funcScope[el.Name] = el.Value;

        var referenciasTask = db.References
            .Find(scope)
            .SortBy(r => r.Name)
            .Project(new BsonDocumentProjectionDefinition<Reference, BsonDocument>(ReferenceFields))
            .ToListAsync(ct);

        var funcionariosTask = db.Funcionarios
            .Find(new BsonDocumentFilterDefinition<Funcionario>(funcScope))
            .Project<Funcionario>(FuncionarioProjection)
            .SortBy(f => f.Nome)
            .ToListAsync(ct);

        await Task.WhenAll(referenciasTask, funcionariosTask);

        var referencias = (await referenciasTask).Select(ParseReferenceNode).ToList();
        var funcionarios = (await funcionariosTask).Select(ToFuncionarioNode).ToList();
        return (referencias, funcionarios);
    }

    public async Task<FuncionarioTreeNode?> FindFuncionarioByIdAsync(
        string id,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return null;
        var filter = Builders<Funcionario>.Filter.Eq(f => f.Id, oid)
                     & new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId));
        var doc = await db.Funcionarios
            .Find(filter)
            .Project<Funcionario>(FuncionarioProjection)
            .FirstOrDefaultAsync(ct);
        return doc is null ? null : ToFuncionarioNode(doc);
    }

    public async Task<(long Referencias, long Funcionarios)> CountDirectChildrenAsync(
        string id,
        string? tenantId,
        CancellationToken ct = default)
    {
        var oid = TenantHelpers.ToObjectId(id);
        if (oid is null) return (0, 0);

        var scope = TenantHelpers.TenantFilter(tenantId);
        var refFilter = new BsonDocument("parentId", oid.Value);
        var funcFilter = new BsonDocument("referenciaId", oid.Value);
        foreach (var el in scope.Elements)
        {
            refFilter[el.Name] = el.Value;
            funcFilter[el.Name] = el.Value;
        }

        var refCount = db.References.CountDocumentsAsync(
            new BsonDocumentFilterDefinition<Reference>(refFilter), cancellationToken: ct);
        var funcCount = db.Funcionarios.CountDocumentsAsync(
            new BsonDocumentFilterDefinition<Funcionario>(funcFilter), cancellationToken: ct);
        await Task.WhenAll(refCount, funcCount);
        return (await refCount, await funcCount);
    }

    public async Task ReparentChildrenAsync(
        string fromId,
        ObjectId? toParentId,
        string? tenantId,
        IClientSessionHandle? session = null,
        CancellationToken ct = default)
    {
        var fromOid = TenantHelpers.ToObjectId(fromId);
        if (fromOid is null) return;

        var filterDoc = new BsonDocument("parentId", fromOid.Value);
        foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
            filterDoc[el.Name] = el.Value;

        var filter = new BsonDocumentFilterDefinition<Reference>(filterDoc);
        var update = Builders<Reference>.Update.Set(r => r.ParentId, toParentId);

        if (session is not null)
            await db.References.UpdateManyAsync(session, filter, update, cancellationToken: ct);
        else
            await db.References.UpdateManyAsync(filter, update, cancellationToken: ct);
    }

    public async Task ReassignFuncionariosAsync(
        string fromId,
        (ObjectId Id, string Name)? toParent,
        string? tenantId,
        IClientSessionHandle? session = null,
        CancellationToken ct = default)
    {
        var fromOid = TenantHelpers.ToObjectId(fromId);
        if (fromOid is null) return;

        var filterDoc = new BsonDocument("referenciaId", fromOid.Value);
        foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
            filterDoc[el.Name] = el.Value;

        var filter = new BsonDocumentFilterDefinition<Funcionario>(filterDoc);
        var update = Builders<Funcionario>.Update
            .Set(f => f.ReferenciaId, toParent?.Id)
            .Set(f => f.Referencia, toParent?.Name);

        if (session is not null)
            await db.Funcionarios.UpdateManyAsync(session, filter, update, cancellationToken: ct);
        else
            await db.Funcionarios.UpdateManyAsync(filter, update, cancellationToken: ct);
    }

    public async Task RenameFuncionariosReferenciaAsync(
        string referenciaId,
        string name,
        string? tenantId,
        CancellationToken ct = default)
    {
        var oid = TenantHelpers.ToObjectId(referenciaId);
        if (oid is null) return;

        var filterDoc = new BsonDocument("referenciaId", oid.Value);
        foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
            filterDoc[el.Name] = el.Value;

        await db.Funcionarios.UpdateManyAsync(
            new BsonDocumentFilterDefinition<Funcionario>(filterDoc),
            Builders<Funcionario>.Update.Set(f => f.Referencia, name),
            cancellationToken: ct);
    }

    public async Task<T> RunAtomicallyAsync<T>(
        Func<IClientSessionHandle?, CancellationToken, Task<T>> work,
        CancellationToken ct = default)
    {
        IClientSessionHandle? session = null;
        try
        {
            session = await db.Database.Client.StartSessionAsync(cancellationToken: ct);
            return await session.WithTransactionAsync(
                async (s, token) => await work(s, token),
                cancellationToken: ct);
        }
        catch (Exception ex) when (IsTransactionUnsupported(ex))
        {
            return await work(null, ct);
        }
        finally
        {
            session?.Dispose();
        }
    }

    private async Task<IReadOnlyList<FuncionarioTreeNode>> FindFuncionariosByReferenciaIdsAsync(
        IReadOnlyList<ObjectId> ids,
        string? tenantId,
        CancellationToken ct)
    {
        if (ids.Count == 0) return [];

        var filterDoc = new BsonDocument(
            "referenciaId",
            new BsonDocument("$in", new BsonArray(ids.Select(i => (BsonValue)i))));
        foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
            filterDoc[el.Name] = el.Value;

        var docs = await db.Funcionarios
            .Find(new BsonDocumentFilterDefinition<Funcionario>(filterDoc))
            .Project<Funcionario>(FuncionarioProjection)
            .SortBy(f => f.Nome)
            .ToListAsync(ct);

        return docs.Select(ToFuncionarioNode).ToList();
    }

    private static ReferenceNode ParseReferenceNode(BsonValue value)
    {
        var doc = value.AsBsonDocument;
        return new ReferenceNode
        {
            Id = doc.GetValue("_id").AsObjectId,
            Name = doc.GetValue("name", "").AsString,
            Cargo = doc.Contains("cargo") && !doc["cargo"].IsBsonNull ? doc["cargo"].AsString : null,
            Telefone = doc.Contains("telefone") && !doc["telefone"].IsBsonNull ? doc["telefone"].AsString : null,
            Origem = doc.Contains("origem") && !doc["origem"].IsBsonNull ? doc["origem"].AsString : null,
            FuncionarioId = doc.Contains("funcionarioId") && doc["funcionarioId"].IsObjectId
                ? doc["funcionarioId"].AsObjectId
                : null,
            ParentId = doc.Contains("parentId") && doc["parentId"].IsObjectId
                ? doc["parentId"].AsObjectId
                : null,
            Depth = doc.Contains("depth") && doc["depth"].IsNumeric
                ? doc["depth"].ToInt32()
                : null,
        };
    }

    private static FuncionarioTreeNode ToFuncionarioNode(Funcionario f) => new()
    {
        Id = f.Id,
        Nome = f.Nome,
        Funcao = f.Funcao,
        Secretaria = f.Secretaria,
        Natureza = f.Natureza,
        ReferenciaId = f.ReferenciaId,
    };

    private static bool IsTransactionUnsupported(Exception error)
    {
        for (var ex = error; ex is not null; ex = ex.InnerException!)
        {
            if (ex is MongoCommandException mce
                && (mce.Code == 20 || string.Equals(mce.CodeName, "IllegalOperation", StringComparison.Ordinal)))
            {
                return true;
            }

            var message = ex.Message ?? "";
            if (Regex.IsMatch(
                    message,
                    @"replica set|Transaction numbers|transactions are not supported",
                    RegexOptions.IgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
