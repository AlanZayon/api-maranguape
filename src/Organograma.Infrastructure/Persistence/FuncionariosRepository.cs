using System.Text.RegularExpressions;
using Organograma.Application.Abstractions;
using Organograma.Application.Funcionarios;
using Organograma.Domain;
using Organograma.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Persistence;

public sealed class FuncionariosRepository(MongoDbContext db) : IFuncionariosRepository
{
    private static string EscapeRegex(string str)
        => Regex.Escape(str);

    private static BsonArray ToMatchIdArray(IEnumerable<object> ids)
    {
        var arr = new BsonArray();
        foreach (var v in TenantHelpers.IdsMatchValues(ids.ToList()))
            arr.Add(v is ObjectId oid ? (BsonValue)oid : (BsonValue)Convert.ToString(v)!);
        return arr;
    }

    public BsonDocument BuildListMatch(ListFilters filters, string? tenantId)
    {
        var match = new BsonDocument(TenantHelpers.TenantFilter(tenantId));

        if (!string.IsNullOrWhiteSpace(filters.Q))
        {
            var regex = new BsonRegularExpression(EscapeRegex(filters.Q.Trim()), "i");
            match["$or"] = new BsonArray
            {
                new BsonDocument("nome", regex),
                new BsonDocument("funcao", regex),
                new BsonDocument("secretaria", regex),
                new BsonDocument("bairro", regex),
                new BsonDocument("cidade", regex),
                new BsonDocument("natureza", regex),
                new BsonDocument("referencia", regex),
                new BsonDocument("telefone", regex),
                new BsonDocument("tipo", regex),
            };
        }

        void Exact(string field, string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            match[field] = new BsonRegularExpression($"^{EscapeRegex(value.Trim())}$", "i");
        }

        Exact("natureza", filters.Natureza);
        Exact("secretaria", filters.Secretaria);
        Exact("funcao", filters.Funcao);
        Exact("bairro", filters.Bairro);
        Exact("referencia", filters.Referencia);
        return match;
    }

    public Task<Funcionario?> FindByNameAsync(string name, string? tenantId, CancellationToken ct = default)
    {
        var filter = Builders<Funcionario>.Filter.Eq(f => f.Nome, name)
                     & new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId));
        return db.Funcionarios.Find(filter).FirstOrDefaultAsync(ct)!;
    }

    public async Task<IReadOnlyList<Funcionario>> FindByIdsAsync(
        IReadOnlyList<string> ids,
        string? tenantId,
        CancellationToken ct = default)
    {
        var oids = ids.Where(id => ObjectId.TryParse(id, out _))
            .Select(ObjectId.Parse)
            .ToList();
        if (oids.Count == 0) return [];

        var filter = Builders<Funcionario>.Filter.In(f => f.Id, oids)
                     & new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId));
        return await db.Funcionarios.Find(filter).ToListAsync(ct);
    }

    public Task<Funcionario?> FindByIdAsync(string id, string? tenantId, CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return Task.FromResult<Funcionario?>(null);
        var filter = Builders<Funcionario>.Filter.Eq(f => f.Id, oid)
                     & new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId));
        return db.Funcionarios.Find(filter).FirstOrDefaultAsync(ct)!;
    }

    public Task<long> CountWithFiltersAsync(ListFilters filters, string? tenantId, CancellationToken ct = default)
        => db.Funcionarios.CountDocumentsAsync(
            new BsonDocumentFilterDefinition<Funcionario>(BuildListMatch(filters, tenantId)),
            cancellationToken: ct);

    public async Task<IReadOnlyList<Funcionario>> FindWithFiltersAsync(
        ListFilters filters, int skip, int limit, string? tenantId, CancellationToken ct = default)
    {
        return await db.Funcionarios
            .Find(new BsonDocumentFilterDefinition<Funcionario>(BuildListMatch(filters, tenantId)))
            .SortBy(f => f.Nome)
            .Skip(skip)
            .Limit(limit)
            .ToListAsync(ct);
    }

    public Task<long> CountParaSelecaoAsync(ListFilters filters, string? tenantId, CancellationToken ct = default)
        => CountWithFiltersAsync(filters, tenantId, ct);

    public async Task<IReadOnlyList<Funcionario>> FindParaSelecaoAsync(
        ListFilters filters, int skip, int limit, string? tenantId, CancellationToken ct = default)
    {
        return await db.Funcionarios
            .Find(new BsonDocumentFilterDefinition<Funcionario>(BuildListMatch(filters, tenantId)))
            .SortBy(f => f.Nome)
            .Skip(skip)
            .Limit(limit)
            .Project<Funcionario>(Builders<Funcionario>.Projection
                .Include(f => f.Nome)
                .Include(f => f.Funcao)
                .Include(f => f.Secretaria)
                .Include(f => f.Natureza)
                .Include(f => f.Telefone)
                .Include(f => f.Tipo)
                .Include(f => f.Referencia)
                .Include(f => f.Bairro)
                .Include(f => f.Cidade))
            .ToListAsync(ct);
    }

    public async Task<object> DistinctFiltrosSelecaoAsync(string? tenantId, CancellationToken ct = default)
    {
        var filter = new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId));
        var naturezas = await (await db.Funcionarios.DistinctAsync<string>("natureza", filter, cancellationToken: ct)).ToListAsync(ct);
        var secretarias = await (await db.Funcionarios.DistinctAsync<string>("secretaria", filter, cancellationToken: ct)).ToListAsync(ct);
        var funcoes = await (await db.Funcionarios.DistinctAsync<string>("funcao", filter, cancellationToken: ct)).ToListAsync(ct);
        var bairros = await (await db.Funcionarios.DistinctAsync<string>("bairro", filter, cancellationToken: ct)).ToListAsync(ct);
        var referencias = await (await db.Funcionarios.DistinctAsync<string>("referencia", filter, cancellationToken: ct)).ToListAsync(ct);

        static List<string> CleanSort(IEnumerable<string> values)
            => values
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Select(v => v.Trim())
                .Distinct()
                .OrderBy(v => v, StringComparer.Create(new System.Globalization.CultureInfo("pt-BR"), false))
                .ToList();

        return new
        {
            naturezas = CleanSort(naturezas),
            secretarias = CleanSort(secretarias),
            funcoes = CleanSort(funcoes),
            bairros = CleanSort(bairros),
            referencias = CleanSort(referencias),
        };
    }

    public async Task<IReadOnlyList<Funcionario>> FindBySetoresFilteredAsync(
        IReadOnlyList<object> idsSetores,
        int skip,
        int limit,
        string? tenantId,
        ListFilters filters,
        CancellationToken ct = default)
    {
        var match = BuildListMatch(filters, tenantId);
        match["setorId"] = new BsonDocument("$in", ToMatchIdArray(idsSetores));
        return await db.Funcionarios
            .Find(new BsonDocumentFilterDefinition<Funcionario>(match))
            .SortBy(f => f.Nome)
            .Skip(skip)
            .Limit(limit)
            .ToListAsync(ct);
    }

    public async Task<long> CountBySetoresExactAsync(
        IReadOnlyList<object> idsSetores,
        string? tenantId,
        ListFilters filters,
        CancellationToken ct = default)
    {
        var matchIds = ToMatchIdArray(idsSetores);
        if (matchIds.Count == 0) return 0;
        var match = BuildListMatch(filters, tenantId);
        match["setorId"] = new BsonDocument("$in", matchIds);
        return await db.Funcionarios.CountDocumentsAsync(
            new BsonDocumentFilterDefinition<Funcionario>(match), cancellationToken: ct);
    }

    public async Task<IReadOnlyList<ObjectId>> FindIdsOnlyAsync(
        ListFilters filters,
        string? tenantId,
        FuncionariosIdsQuery query,
        CancellationToken ct = default)
    {
        var match = BuildListMatch(filters, tenantId);
        if (!string.IsNullOrWhiteSpace(query.SubtreeRoot))
        {
            var ids = await GetDescendantSetorIdsAsync(query.SubtreeRoot, tenantId, ct);
            if (ids.Count == 0) return [];
            match["setorId"] = new BsonDocument("$in", ToMatchIdArray(ids.Cast<object>()));
        }
        else if (query.SetorIds is { Count: > 0 })
        {
            match["setorId"] = new BsonDocument("$in", ToMatchIdArray(query.SetorIds));
        }

        var docs = await db.Funcionarios
            .Find(new BsonDocumentFilterDefinition<Funcionario>(match))
            .Project(f => f.Id)
            .Limit(query.Max)
            .ToListAsync(ct);
        return docs;
    }

    public async Task<Funcionario> CreateAsync(Funcionario data, CancellationToken ct = default)
    {
        if (data.Id == ObjectId.Empty) data.Id = ObjectId.GenerateNewId();
        if (data.CreatedAt == default) data.CreatedAt = DateTime.UtcNow;
        await db.Funcionarios.InsertOneAsync(data, cancellationToken: ct);
        return data;
    }

    public async Task<Funcionario?> UpdateAsync(
        string id,
        BsonDocument setFields,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return null;
        var filter = Builders<Funcionario>.Filter.Eq(f => f.Id, oid)
                     & new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId));
        var update = new BsonDocument("$set", setFields);
        return await db.Funcionarios.FindOneAndUpdateAsync(
            filter,
            new BsonDocumentUpdateDefinition<Funcionario>(update),
            new FindOneAndUpdateOptions<Funcionario> { ReturnDocument = ReturnDocument.After },
            ct);
    }

    public async Task<long> DeleteBatchAsync(
        IReadOnlyList<string> userIds,
        string? tenantId,
        CancellationToken ct = default)
    {
        var oids = userIds.Where(id => ObjectId.TryParse(id, out _)).Select(ObjectId.Parse).ToList();
        if (oids.Count == 0) return 0;
        var filter = Builders<Funcionario>.Filter.In(f => f.Id, oids)
                     & new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId));
        var result = await db.Funcionarios.DeleteManyAsync(filter, ct);
        return result.DeletedCount;
    }

    public async Task UpdateSetorIdAsync(
        IReadOnlyList<string> userIds,
        string newSetorId,
        string? tenantId,
        CancellationToken ct = default)
    {
        var oids = userIds.Where(id => ObjectId.TryParse(id, out _)).Select(ObjectId.Parse).ToList();
        if (oids.Count == 0 || !ObjectId.TryParse(newSetorId, out var setorOid)) return;

        var filter = Builders<Funcionario>.Filter.In(f => f.Id, oids)
                     & new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId));
        await db.Funcionarios.UpdateManyAsync(
            filter,
            Builders<Funcionario>.Update.Set(f => f.SetorId, setorOid),
            cancellationToken: ct);
    }

    public async Task<Funcionario?> UpdateObservacoesAsync(
        string userId,
        IReadOnlyList<BsonValue> observacoes,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(userId, out var oid)) return null;
        var filter = Builders<Funcionario>.Filter.Eq(f => f.Id, oid)
                     & new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId));
        return await db.Funcionarios.FindOneAndUpdateAsync(
            filter,
            Builders<Funcionario>.Update.Set(f => f.Observacoes, observacoes.ToList()),
            new FindOneAndUpdateOptions<Funcionario> { ReturnDocument = ReturnDocument.After },
            ct);
    }

    public async Task<IReadOnlyList<ObjectId>> GetDescendantSetorIdsAsync(
        object idsSetores,
        string? tenantId,
        CancellationToken ct = default)
    {
        var roots = TenantHelpers.IdsMatchValues(idsSetores)
            .OfType<ObjectId>()
            .ToList();
        // Also parse string ObjectIds
        foreach (var v in TenantHelpers.IdsMatchValues(idsSetores))
        {
            if (v is string s && ObjectId.TryParse(s, out var oid) && !roots.Contains(oid))
                roots.Add(oid);
        }
        if (roots.Count == 0) return [];

        var seen = new HashSet<string>(roots.Select(r => r.ToString()));
        var frontier = new List<ObjectId>(roots);
        var tenantFilter = TenantHelpers.TenantFilter(tenantId);

        while (frontier.Count > 0)
        {
            var matchIds = ToMatchIdArray(frontier.Cast<object>());
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
                if (!seen.Add(childId.ToString())) continue;
                next.Add(childId);
            }
            frontier = next;
        }

        return seen.Where(s => ObjectId.TryParse(s, out _)).Select(ObjectId.Parse).ToList();
    }

    public async Task<long> CountBySetorAsync(
        object idsSetores,
        string? tenantId,
        ListFilters filters,
        CancellationToken ct = default)
    {
        var setorIds = await GetDescendantSetorIdsAsync(idsSetores, tenantId, ct);
        if (setorIds.Count == 0) return 0;
        return await CountBySetoresExactAsync(setorIds.Cast<object>().ToList(), tenantId, filters, ct);
    }

    public async Task<IReadOnlyList<Funcionario>> BuscarFuncionariosPorSetorAsync(
        object idSetor,
        int skip,
        int limit,
        string? tenantId,
        ListFilters filters,
        CancellationToken ct = default)
    {
        var setorIds = await GetDescendantSetorIdsAsync(idSetor, tenantId, ct);
        if (setorIds.Count == 0) return [];
        return await FindBySetoresFilteredAsync(setorIds.Cast<object>().ToList(), skip, limit, tenantId, filters, ct);
    }

    public async Task<IReadOnlyList<Funcionario>> FindForExportAsync(
        string? tenantId,
        IReadOnlyList<string>? ids,
        CancellationToken ct = default)
    {
        var match = new BsonDocument(TenantHelpers.TenantFilter(tenantId));
        if (ids is { Count: > 0 })
        {
            var oids = ids.Where(id => ObjectId.TryParse(id, out _)).Select(ObjectId.Parse).ToList();
            match["_id"] = new BsonDocument("$in", new BsonArray(oids.Select(o => (BsonValue)o)));
        }
        return await db.Funcionarios
            .Find(new BsonDocumentFilterDefinition<Funcionario>(match))
            .Project<Funcionario>(Builders<Funcionario>.Projection
                .Include(f => f.Nome)
                .Include(f => f.Secretaria)
                .Include(f => f.Funcao)
                .Include(f => f.Natureza)
                .Include(f => f.Referencia)
                .Include(f => f.SalarioBruto))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Setor>> FindSetoresByIdsAsync(
        IReadOnlyList<object> ids,
        string? tenantId,
        CancellationToken ct = default)
    {
        var matchIds = ToMatchIdArray(ids);
        if (matchIds.Count == 0) return [];
        var filterDoc = new BsonDocument("_id", new BsonDocument("$in", matchIds));
        foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
            filterDoc[el.Name] = el.Value;
        return await db.Setors.Find(new BsonDocumentFilterDefinition<Setor>(filterDoc)).ToListAsync(ct);
    }
}

public sealed class ReferenceLookup(MongoDbContext db) : IReferenceLookup
{
    public Task<Reference?> FindByIdAsync(string id, string? tenantId, CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return Task.FromResult<Reference?>(null);
        var filter = Builders<Reference>.Filter.Eq(r => r.Id, oid)
                     & new BsonDocumentFilterDefinition<Reference>(TenantHelpers.TenantFilter(tenantId));
        return db.References.Find(filter).FirstOrDefaultAsync(ct)!;
    }

    public Task<Reference?> FindByNameAsync(string name, string? tenantId, CancellationToken ct = default)
    {
        var filter = Builders<Reference>.Filter.Eq(r => r.Name, name.ToUpperInvariant())
                     & new BsonDocumentFilterDefinition<Reference>(TenantHelpers.TenantFilter(tenantId));
        return db.References.Find(filter).FirstOrDefaultAsync(ct)!;
    }
}
