using System.Text.RegularExpressions;
using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Persistence;

/// <summary>Ports Nest <c>modules/search/search.repository.ts</c> — Atlas <c>$search</c> + regex fallback.</summary>
public sealed class SearchRepository(MongoDbContext db) : ISearchRepository
{
    public static string EscapeRegex(string str)
        => Regex.Escape(str);

    public static bool IsMissingSearchIndex(Exception error)
    {
        var message = error.Message ?? "";
        var code = (error as MongoCommandException)?.Code
                   ?? (error as MongoException)?.GetType().GetProperty("Code")?.GetValue(error) as int?;

        return code is 27
               || message.Contains("IndexNotFound", StringComparison.OrdinalIgnoreCase)
               || message.Contains("text index required", StringComparison.OrdinalIgnoreCase)
               || message.Contains("$search", StringComparison.OrdinalIgnoreCase)
               || message.Contains("Unrecognized pipeline stage", StringComparison.OrdinalIgnoreCase)
               || message.Contains("PlanExecutor error", StringComparison.OrdinalIgnoreCase);
    }

    private static BsonDocument? TenantMatchStage(string? tenantId)
    {
        var filter = TenantHelpers.TenantFilter(tenantId);
        return filter.ElementCount == 0 ? null : new BsonDocument("$match", filter);
    }

    public async Task<IReadOnlyList<ObjectId>> GetDescendantIdsAsync(
        object id,
        string? tenantId,
        CancellationToken ct = default)
    {
        BsonValue objectId = ObjectId.TryParse(Convert.ToString(id), out var oid)
            ? oid
            : BsonValue.Create(id);

        var match = new BsonDocument("_id", objectId);
        foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
            match[el.Name] = el.Value;

        var graphLookup = new BsonDocument("$graphLookup", new BsonDocument
        {
            { "from", MongoDbContext.SetorsCollection },
            { "startWith", "$_id" },
            { "connectFromField", "_id" },
            { "connectToField", "parent" },
            { "as", "descendants" },
        });

        if (!string.IsNullOrWhiteSpace(tenantId))
            graphLookup["$graphLookup"].AsBsonDocument["restrictSearchWithMatch"] =
                TenantHelpers.TenantFilter(tenantId);

        var pipeline = new[]
        {
            new BsonDocument("$match", match),
            graphLookup,
        };

        var setores = await db.Setors.Aggregate<BsonDocument>(pipeline).ToListAsync(ct);
        if (setores.Count == 0) return [];

        var result = new List<ObjectId>();
        foreach (var s in setores)
        {
            if (s.TryGetValue("_id", out var rootId) && rootId.IsObjectId)
                result.Add(rootId.AsObjectId);
            if (s.TryGetValue("descendants", out var desc) && desc.IsBsonArray)
            {
                foreach (var d in desc.AsBsonArray)
                {
                    if (d.IsBsonDocument && d.AsBsonDocument.TryGetValue("_id", out var did) && did.IsObjectId)
                        result.Add(did.AsObjectId);
                }
            }
        }

        return result;
    }

    public async Task<IReadOnlyList<BsonDocument>> AutocompleteFuncionariosAsync(
        string termo,
        string? tenantId,
        CancellationToken ct = default)
    {
        // Without Atlas Search indexes, $search often returns [] (no throw).
        // Prefer Atlas when it finds hits; otherwise always use regex fallback.
        if (IsAtlasSearchEnabled())
        {
            try
            {
                var pipeline = new List<BsonDocument>
                {
                    new("$search", new BsonDocument
                    {
                        { "index", "autocomplete_funcionarios" },
                        {
                            "compound", new BsonDocument("should", new BsonArray
                            {
                                AutocompleteClause(termo, "nome"),
                                AutocompleteClause(termo, "funcao"),
                                AutocompleteClause(termo, "bairro"),
                                AutocompleteClause(termo, "cidade"),
                                AutocompleteClause(termo, "natureza"),
                                AutocompleteClause(termo, "tipo"),
                                AutocompleteClause(termo, "referencia"),
                            })
                        },
                    }),
                };

                var tenantStage = TenantMatchStage(tenantId);
                if (tenantStage is not null) pipeline.Add(tenantStage);

                pipeline.Add(new BsonDocument("$limit", 10));
                pipeline.Add(new BsonDocument("$project", new BsonDocument("termo", BuildTermoCond(termo))));

                var atlas = await db.Funcionarios.Aggregate<BsonDocument>(pipeline).ToListAsync(ct);
                if (atlas.Count > 0) return atlas;
            }
            catch (Exception ex) when (IsMissingSearchIndex(ex))
            {
                // fall through to regex
            }
        }

        return await AutocompleteFuncionariosRegexAsync(termo, tenantId, ct);
    }

    private async Task<IReadOnlyList<BsonDocument>> AutocompleteFuncionariosRegexAsync(
        string termo,
        string? tenantId,
        CancellationToken ct)
    {
        var regex = new BsonRegularExpression(EscapeRegex(termo), "i");
        var filter = new BsonDocument("$or", new BsonArray
        {
            new BsonDocument("nome", regex),
            new BsonDocument("funcao", regex),
            new BsonDocument("bairro", regex),
            new BsonDocument("cidade", regex),
        });
        foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
            filter[el.Name] = el.Value;

        var funcionarios = await db.Funcionarios
            .Find(new BsonDocumentFilterDefinition<Funcionario>(filter))
            .Limit(10)
            .Project(f => new { f.Nome, f.Funcao, f.Bairro, f.Cidade })
            .ToListAsync(ct);

        var rx = new Regex(EscapeRegex(termo), RegexOptions.IgnoreCase);
        return funcionarios.Select(f =>
        {
            if (rx.IsMatch(f.Nome ?? ""))
                return new BsonDocument("termo", new BsonDocument { { "nome", f.Nome }, { "tipo", "Funcionário" } });
            if (rx.IsMatch(f.Funcao ?? ""))
                return new BsonDocument("termo", new BsonDocument { { "nome", f.Funcao }, { "tipo", "Função" } });
            if (rx.IsMatch(f.Bairro ?? ""))
                return new BsonDocument("termo", new BsonDocument { { "nome", f.Bairro }, { "tipo", "Bairro" } });
            return new BsonDocument("termo", new BsonDocument { { "nome", f.Cidade ?? "" }, { "tipo", "Cidade" } });
        }).ToList();
    }

    public async Task<IReadOnlyList<BsonDocument>> AutocompleteSetoresAsync(
        string termo,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (IsAtlasSearchEnabled())
        {
            try
            {
                var pipeline = new List<BsonDocument>
                {
                    new("$search", new BsonDocument
                    {
                        { "index", "autocomplete_setores" },
                        {
                            "compound",
                            new BsonDocument("should", new BsonArray { AutocompleteClause(termo, "nome") })
                        },
                    }),
                };

                var tenantStage = TenantMatchStage(tenantId);
                if (tenantStage is not null) pipeline.Add(tenantStage);

                pipeline.Add(new BsonDocument("$limit", 10));
                pipeline.Add(new BsonDocument("$project", new BsonDocument("termo", new BsonDocument
                {
                    { "nome", "$nome" },
                    { "tipo", "$tipo" },
                })));

                var atlas = await db.Setors.Aggregate<BsonDocument>(pipeline).ToListAsync(ct);
                if (atlas.Count > 0) return atlas;
            }
            catch (Exception ex) when (IsMissingSearchIndex(ex))
            {
                // fall through to regex
            }
        }

        return await AutocompleteSetoresRegexAsync(termo, tenantId, ct);
    }

    private async Task<IReadOnlyList<BsonDocument>> AutocompleteSetoresRegexAsync(
        string termo,
        string? tenantId,
        CancellationToken ct)
    {
        var regex = new BsonRegularExpression(EscapeRegex(termo), "i");
        var filter = new BsonDocument("nome", regex);
        foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
            filter[el.Name] = el.Value;

        var setores = await db.Setors
            .Find(new BsonDocumentFilterDefinition<Setor>(filter))
            .Limit(10)
            .Project(s => new { s.Nome, s.Tipo })
            .ToListAsync(ct);

        return setores.Select(s => new BsonDocument("termo", new BsonDocument
        {
            { "nome", s.Nome },
            { "tipo", s.Tipo },
        })).ToList();
    }

    public async Task<IReadOnlyList<BsonDocument>> SearchSetoresAsync(
        string q,
        string? tenantId,
        CancellationToken ct = default)
    {
        try
        {
            var filter = Builders<Setor>.Filter.Text(q)
                         & new BsonDocumentFilterDefinition<Setor>(TenantHelpers.TenantFilter(tenantId));

            return await db.Setors
                .Find(filter)
                .Project(Builders<Setor>.Projection
                    .MetaTextScore("score")
                    .Include(s => s.Tipo)
                    .Include(s => s.Nome)
                    .Include(s => s.Id))
                .Sort(Builders<Setor>.Sort.MetaTextScore("score"))
                .Limit(5)
                .As<BsonDocument>()
                .ToListAsync(ct);
        }
        catch (Exception ex) when (IsMissingSearchIndex(ex))
        {
            var regex = new BsonRegularExpression(EscapeRegex(q), "i");
            var filter = new BsonDocument("nome", regex);
            foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
                filter[el.Name] = el.Value;

            var setores = await db.Setors
                .Find(new BsonDocumentFilterDefinition<Setor>(filter))
                .Limit(5)
                .Project(s => new { s.Id, s.Tipo, s.Nome })
                .ToListAsync(ct);

            return setores.Select(s => new BsonDocument
            {
                { "_id", s.Id },
                { "tipo", s.Tipo },
                { "nome", s.Nome },
            }).ToList();
        }
    }

    public async Task<IReadOnlyList<ObjectId>> FindFuncionarioIdsBySetorIdsAsync(
        IReadOnlyList<ObjectId> setorIds,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (setorIds.Count == 0) return [];

        var filter = Builders<Funcionario>.Filter.In(f => f.SetorId, setorIds)
                     & new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId));

        return await db.Funcionarios
            .Find(filter)
            .Project(f => f.Id)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<ObjectId>> SearchFuncionariosDirectlyAsync(
        string q,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (IsAtlasSearchEnabled())
        {
            try
            {
                var pipeline = new List<BsonDocument>
                {
                    new("$search", new BsonDocument
                    {
                        { "index", "busca_geral_funcionarios" },
                        {
                            "text", new BsonDocument
                            {
                                { "query", q },
                                {
                                    "path",
                                    new BsonArray
                                    {
                                        "bairro", "cidade", "funcao", "natureza", "nome", "referencia", "tipo",
                                    }
                                },
                            }
                        },
                    }),
                };

                var tenantStage = TenantMatchStage(tenantId);
                if (tenantStage is not null) pipeline.Add(tenantStage);

                pipeline.Add(new BsonDocument("$limit", 20));
                pipeline.Add(new BsonDocument("$project", new BsonDocument("_id", 1)));

                var docs = await db.Funcionarios.Aggregate<BsonDocument>(pipeline).ToListAsync(ct);
                var ids = docs
                    .Where(d => d.Contains("_id") && d["_id"].IsObjectId)
                    .Select(d => d["_id"].AsObjectId)
                    .ToList();
                if (ids.Count > 0) return ids;
            }
            catch (Exception ex) when (IsMissingSearchIndex(ex))
            {
                // fall through to regex
            }
        }

        return await SearchFuncionariosRegexAsync(q, tenantId, ct);
    }

    private async Task<IReadOnlyList<ObjectId>> SearchFuncionariosRegexAsync(
        string q,
        string? tenantId,
        CancellationToken ct)
    {
        var regex = new BsonRegularExpression(EscapeRegex(q), "i");
        var filter = new BsonDocument("$or", new BsonArray
        {
            new BsonDocument("nome", regex),
            new BsonDocument("funcao", regex),
            new BsonDocument("secretaria", regex),
            new BsonDocument("natureza", regex),
            new BsonDocument("referencia", regex),
            new BsonDocument("bairro", regex),
            new BsonDocument("cidade", regex),
        });
        foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
            filter[el.Name] = el.Value;

        return await db.Funcionarios
            .Find(new BsonDocumentFilterDefinition<Funcionario>(filter))
            .Limit(20)
            .Project(f => f.Id)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Opt-in Atlas Search. Default off so autocomplete/busca work via regex
    /// until indexes <c>autocomplete_*</c> / <c>busca_geral_funcionarios</c> exist.
    /// </summary>
    private static bool IsAtlasSearchEnabled()
    {
        var raw = Environment.GetEnvironmentVariable("ATLAS_SEARCH_ENABLED");
        return string.Equals(raw, "1", StringComparison.OrdinalIgnoreCase)
               || string.Equals(raw, "true", StringComparison.OrdinalIgnoreCase)
               || string.Equals(raw, "yes", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<IReadOnlyList<Funcionario>> GetFuncionariosByIdsAsync(
        IReadOnlyList<ObjectId> ids,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (ids.Count == 0) return [];

        var filter = Builders<Funcionario>.Filter.In(f => f.Id, ids)
                     & new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId));

        return await db.Funcionarios.Find(filter).Limit(20).ToListAsync(ct);
    }

    private static BsonDocument AutocompleteClause(string query, string path) => new()
    {
        {
            "autocomplete", new BsonDocument
            {
                { "query", query },
                { "path", path },
            }
        },
    };

    /// <summary>Nested $cond chain matching Nest projection for which field matched.</summary>
    private static BsonDocument BuildTermoCond(string termo)
    {
        BsonDocument Leaf(string field, string tipo) => new()
        {
            { "nome", $"${field}" },
            { "tipo", tipo },
        };

        BsonDocument Cond(string field, string tipo, BsonValue elseBranch) => new("$cond", new BsonArray
        {
            new BsonDocument("$regexMatch", new BsonDocument
            {
                { "input", $"${field}" },
                { "regex", termo },
                { "options", "i" },
            }),
            Leaf(field, tipo),
            elseBranch,
        });

        return Cond("nome", "Funcionário",
            Cond("funcao", "Função",
                Cond("bairro", "Bairro",
                    Cond("cidade", "Cidade",
                        Cond("natureza", "Natureza",
                            Cond("tipo", "Tipo", Leaf("referencia", "Referência")))))));
    }
}
