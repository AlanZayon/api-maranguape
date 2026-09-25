using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Persistence;

/// <summary>Ports Nest <c>modules/dashboard/dashboard.repository.ts</c>.</summary>
public sealed class DashboardRepository(MongoDbContext db) : IDashboardRepository
{
    private static readonly BsonDocument SalarioExpr = new("$convert", new BsonDocument
    {
        { "input", "$salarioBruto" },
        { "to", "double" },
        { "onError", 0 },
        { "onNull", 0 },
    });

    public Task<long> CountByTenantAsync(string? tenantId, CancellationToken ct = default)
        => db.Funcionarios.CountDocumentsAsync(
            new BsonDocumentFilterDefinition<Funcionario>(TenantHelpers.TenantFilter(tenantId)),
            cancellationToken: ct);

    public async Task<IReadOnlyList<object>> GroupByFieldAsync(
        string field,
        string? tenantId,
        int? topN = null,
        CancellationToken ct = default)
    {
        var pipeline = new List<BsonDocument>
        {
            new("$match", TenantHelpers.TenantFilter(tenantId)),
            new("$group", new BsonDocument
            {
                { "_id", new BsonDocument("$ifNull", new BsonArray { $"${field}", "Não informada" }) },
                { "count", new BsonDocument("$sum", 1) },
            }),
            new("$sort", new BsonDocument("count", -1)),
        };
        if (topN is > 0)
            pipeline.Add(new BsonDocument("$limit", topN.Value));

        var rows = await db.Funcionarios.Aggregate<BsonDocument>(pipeline).ToListAsync(ct);
        return rows.Select(r => (object)new Dictionary<string, object?>
        {
            [field] = r.GetValue("_id", "Não informada").ToString() ?? "Não informada",
            ["count"] = r.GetValue("count", 0).ToInt32(),
        }).ToList();
    }

    public async Task<ContratoBucketsDto> CountContratosBucketsAsync(
        string? tenantId,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var d30 = now.AddDays(30);
        var d60 = now.AddDays(60);
        var d90 = now.AddDays(90);

        var pipeline = new[]
        {
            new BsonDocument("$match", TenantHelpers.TenantFilter(tenantId)),
            new BsonDocument("$facet", new BsonDocument
            {
                {
                    "in30", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("fimContrato", new BsonDocument
                        {
                            { "$type", "date" },
                            { "$gte", now },
                            { "$lte", d30 },
                        })),
                        new BsonDocument("$count", "n"),
                    }
                },
                {
                    "in31to60", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("fimContrato", new BsonDocument
                        {
                            { "$type", "date" },
                            { "$gt", d30 },
                            { "$lte", d60 },
                        })),
                        new BsonDocument("$count", "n"),
                    }
                },
                {
                    "in61to90", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("fimContrato", new BsonDocument
                        {
                            { "$type", "date" },
                            { "$gt", d60 },
                            { "$lte", d90 },
                        })),
                        new BsonDocument("$count", "n"),
                    }
                },
                {
                    "expired", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("fimContrato", new BsonDocument
                        {
                            { "$type", "date" },
                            { "$lt", now },
                        })),
                        new BsonDocument("$count", "n"),
                    }
                },
                {
                    "indeterminado", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("fimContrato", "indeterminado")),
                        new BsonDocument("$count", "n"),
                    }
                },
            }),
        };

        var rows = await db.Funcionarios.Aggregate<BsonDocument>(pipeline).ToListAsync(ct);
        var row = rows.FirstOrDefault() ?? new BsonDocument();

        return new ContratoBucketsDto
        {
            In30 = CountOf(row, "in30"),
            In31to60 = CountOf(row, "in31to60"),
            In61to90 = CountOf(row, "in61to90"),
            Expired = CountOf(row, "expired"),
            Indeterminado = CountOf(row, "indeterminado"),
        };
    }

    public async Task<IReadOnlyList<object>> FindContratosAVencerAsync(
        string? tenantId,
        int withinDays = 90,
        int limit = 20,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var until = now.AddDays(withinDays);

        var filter = new BsonDocument("fimContrato", new BsonDocument
        {
            { "$type", "date" },
            { "$gte", now },
            { "$lte", until },
        });
        foreach (var el in TenantHelpers.TenantFilter(tenantId).Elements)
            filter[el.Name] = el.Value;

        var docs = await db.Funcionarios
            .Find(new BsonDocumentFilterDefinition<Funcionario>(filter))
            .Project(Builders<Funcionario>.Projection
                .Include(f => f.Nome)
                .Include(f => f.Natureza)
                .Include(f => f.Secretaria)
                .Include(f => f.SetorId)
                .Include(f => f.FimContrato))
            .Sort(Builders<Funcionario>.Sort.Ascending(f => f.FimContrato))
            .Limit(limit)
            .As<BsonDocument>()
            .ToListAsync(ct);

        const double msPerDay = 1000 * 60 * 60 * 24;
        return docs.Select(doc =>
        {
            DateTime? fim = null;
            if (doc.TryGetValue("fimContrato", out var fc) && fc.IsValidDateTime)
                fim = fc.ToUniversalTime();

            var diasRestantes = fim is null
                ? 0
                : Math.Max(0, (int)Math.Ceiling((fim.Value - now).TotalMilliseconds / msPerDay));

            return (object)new Dictionary<string, object?>
            {
                ["_id"] = doc.GetValue("_id").ToString(),
                ["nome"] = doc.GetValue("nome", "").ToString(),
                ["natureza"] = doc.GetValue("natureza", "").ToString(),
                ["secretaria"] = doc.GetValue("secretaria", "").ToString(),
                ["setorId"] = doc.GetValue("setorId", BsonNull.Value).ToString(),
                ["fimContrato"] = fim,
                ["diasRestantes"] = diasRestantes,
            };
        }).ToList();
    }

    public async Task<object> AggregatePayrollAsync(
        string? tenantId,
        int topSecretarias = 10,
        CancellationToken ct = default)
    {
        var filter = TenantHelpers.TenantFilter(tenantId);

        var totalsTask = db.Funcionarios.Aggregate<BsonDocument>(new List<BsonDocument>
        {
            new("$match", filter),
            new("$group", new BsonDocument
            {
                { "_id", BsonNull.Value },
                { "total", new BsonDocument("$sum", SalarioExpr) },
                { "media", new BsonDocument("$avg", SalarioExpr) },
                { "count", new BsonDocument("$sum", 1) },
            }),
        }).ToListAsync(ct);

        var byNaturezaTask = db.Funcionarios.Aggregate<BsonDocument>(new List<BsonDocument>
        {
            new("$match", filter),
            new("$group", new BsonDocument
            {
                { "_id", new BsonDocument("$ifNull", new BsonArray { "$natureza", "Não informada" }) },
                { "total", new BsonDocument("$sum", SalarioExpr) },
                { "media", new BsonDocument("$avg", SalarioExpr) },
                { "count", new BsonDocument("$sum", 1) },
            }),
            new("$sort", new BsonDocument("total", -1)),
        }).ToListAsync(ct);

        var bySecretariaTask = db.Funcionarios.Aggregate<BsonDocument>(new List<BsonDocument>
        {
            new("$match", filter),
            new("$group", new BsonDocument
            {
                { "_id", new BsonDocument("$ifNull", new BsonArray { "$secretaria", "Não informada" }) },
                { "total", new BsonDocument("$sum", SalarioExpr) },
                { "media", new BsonDocument("$avg", SalarioExpr) },
                { "count", new BsonDocument("$sum", 1) },
            }),
            new("$sort", new BsonDocument("total", -1)),
            new("$limit", topSecretarias),
        }).ToListAsync(ct);

        await Task.WhenAll(totalsTask, byNaturezaTask, bySecretariaTask);

        var totals = await totalsTask;
        var byNatureza = await byNaturezaTask;
        var bySecretaria = await bySecretariaTask;

        var t = totals.FirstOrDefault() ?? new BsonDocument
        {
            { "total", 0 },
            { "media", 0 },
            { "count", 0 },
        };

        return new
        {
            total = t.GetValue("total", 0).ToDouble(),
            media = t.GetValue("media", 0).ToDouble(),
            count = t.GetValue("count", 0).ToInt32(),
            byNatureza = byNatureza.Select(r => new
            {
                natureza = r.GetValue("_id", "Não informada").ToString(),
                total = r.GetValue("total", 0).ToDouble(),
                media = r.GetValue("media", 0).ToDouble(),
                count = r.GetValue("count", 0).ToInt32(),
            }),
            bySecretaria = bySecretaria.Select(r => new
            {
                secretaria = r.GetValue("_id", "Não informada").ToString(),
                total = r.GetValue("total", 0).ToDouble(),
                media = r.GetValue("media", 0).ToDouble(),
                count = r.GetValue("count", 0).ToInt32(),
            }),
        };
    }

    public async Task<Dictionary<string, int>> CountOcupadasPorSimbologiaAsync(
        string? tenantId,
        CancellationToken ct = default)
    {
        var match = TenantHelpers.TenantFilter(tenantId);
        match["natureza"] = "COMISSIONADO";

        var pipeline = new[]
        {
            new BsonDocument("$match", match),
            new BsonDocument("$lookup", new BsonDocument
            {
                { "from", MongoDbContext.CargosComissionadosCollection },
                { "localField", "funcao" },
                { "foreignField", "cargo" },
                { "as", "cargoInfo" },
            }),
            new BsonDocument("$unwind", new BsonDocument
            {
                { "path", "$cargoInfo" },
                { "preserveNullAndEmptyArrays", false },
            }),
            new BsonDocument("$group", new BsonDocument
            {
                { "_id", "$cargoInfo.simbologia" },
                { "ocupadas", new BsonDocument("$sum", 1) },
            }),
        };

        var rows = await db.Funcionarios.Aggregate<BsonDocument>(pipeline).ToListAsync(ct);
        return rows.ToDictionary(
            r => r.GetValue("_id", "").ToString() ?? "",
            r => r.GetValue("ocupadas", 0).ToInt32());
    }

    public async Task<IReadOnlyList<LimiteSimbologia>> ListSimbologiasAsync(
        string? tenantId,
        CancellationToken ct = default)
    {
        var filter = new BsonDocumentFilterDefinition<LimiteSimbologia>(TenantHelpers.TenantFilter(tenantId));
        return await db.Simbologias.Find(filter).ToListAsync(ct);
    }

    private static int CountOf(BsonDocument row, string bucket)
    {
        if (!row.TryGetValue(bucket, out var arr) || !arr.IsBsonArray || arr.AsBsonArray.Count == 0)
            return 0;
        var first = arr.AsBsonArray[0];
        if (!first.IsBsonDocument) return 0;
        return first.AsBsonDocument.GetValue("n", 0).ToInt32();
    }
}
