using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Persistence;

public sealed class CargosComissionadosRepository(MongoDbContext db) : ICargosComissionadosRepository
{
    public async Task<IReadOnlyList<BsonDocument>> BuscarTodosAsync(
        string? tenantId,
        CancellationToken ct = default)
    {
        var pipeline = new List<BsonDocument>();
        var match = TenantHelpers.TenantFilter(tenantId);
        if (match.ElementCount > 0)
            pipeline.Add(new BsonDocument("$match", match));

        var tenantValues = TenantHelpers.IdMatchValues(tenantId);
        BsonDocument lookupMatch;
        if (tenantValues.Count > 0)
        {
            var inArr = new BsonArray(
                tenantValues.Select(v => v is ObjectId oid ? (BsonValue)oid : (BsonValue)Convert.ToString(v)!));
            lookupMatch = new BsonDocument("$expr", new BsonDocument("$and", new BsonArray
            {
                new BsonDocument("$eq", new BsonArray { "$simbologia", "$$simb" }),
                new BsonDocument("$in", new BsonArray { "$tenantId", inArr }),
            }));
        }
        else
        {
            lookupMatch = new BsonDocument("$expr",
                new BsonDocument("$eq", new BsonArray { "$simbologia", "$$simb" }));
        }

        pipeline.Add(new BsonDocument("$lookup", new BsonDocument
        {
            { "from", MongoDbContext.SimbologiasCollection },
            { "let", new BsonDocument("simb", "$simbologia") },
            { "pipeline", new BsonArray { new BsonDocument("$match", lookupMatch) } },
            { "as", "simbologiaInfo" },
        }));
        pipeline.Add(new BsonDocument("$unwind", new BsonDocument
        {
            { "path", "$simbologiaInfo" },
            { "preserveNullAndEmptyArrays", true },
        }));
        pipeline.Add(new BsonDocument("$sort", new BsonDocument("cargo", 1)));

        return await db.CargosComissionados.Aggregate<BsonDocument>(pipeline).ToListAsync(ct);
    }

    public Task<CargoComissionado?> BuscarPorIdAsync(string id, string? tenantId, CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return Task.FromResult<CargoComissionado?>(null);
        var filter = Builders<CargoComissionado>.Filter.Eq(c => c.Id, oid)
                     & new BsonDocumentFilterDefinition<CargoComissionado>(TenantHelpers.TenantFilter(tenantId));
        return db.CargosComissionados.Find(filter).FirstOrDefaultAsync(ct)!;
    }

    public Task<CargoComissionado?> BuscarPorNomeAsync(string nome, string? tenantId, CancellationToken ct = default)
    {
        var filter = Builders<CargoComissionado>.Filter.Eq(c => c.Cargo, nome)
                     & new BsonDocumentFilterDefinition<CargoComissionado>(TenantHelpers.TenantFilter(tenantId));
        return db.CargosComissionados.Find(filter).FirstOrDefaultAsync(ct)!;
    }

    public async Task<CargoComissionado> CriarAsync(CargoComissionado cargo, CancellationToken ct = default)
    {
        if (cargo.Id == ObjectId.Empty) cargo.Id = ObjectId.GenerateNewId();
        await db.CargosComissionados.InsertOneAsync(cargo, cancellationToken: ct);
        return cargo;
    }

    public async Task<CargoComissionado?> AtualizarAsync(
        string id,
        CargoComissionado patch,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return null;
        var filter = Builders<CargoComissionado>.Filter.Eq(c => c.Id, oid)
                     & new BsonDocumentFilterDefinition<CargoComissionado>(TenantHelpers.TenantFilter(tenantId));
        var update = Builders<CargoComissionado>.Update
            .Set(c => c.Tipo, patch.Tipo)
            .Set(c => c.Cargo, patch.Cargo)
            .Set(c => c.Simbologia, patch.Simbologia)
            .Set(c => c.ADefinir, patch.ADefinir)
            .Set(c => c.UpdatedBy, patch.UpdatedBy);
        return await db.CargosComissionados.FindOneAndUpdateAsync(
            filter,
            update,
            new FindOneAndUpdateOptions<CargoComissionado> { ReturnDocument = ReturnDocument.After },
            ct);
    }

    public async Task<CargoComissionado?> RemoverAsync(string id, string? tenantId, CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return null;
        var filter = Builders<CargoComissionado>.Filter.Eq(c => c.Id, oid)
                     & new BsonDocumentFilterDefinition<CargoComissionado>(TenantHelpers.TenantFilter(tenantId));
        return await db.CargosComissionados.FindOneAndDeleteAsync(filter, cancellationToken: ct);
    }

    public Task<LimiteSimbologia?> BuscarPorSimbologiaAsync(
        string simbologia,
        string? tenantId,
        CancellationToken ct = default)
    {
        var filter = Builders<LimiteSimbologia>.Filter.Eq(s => s.Simbologia, simbologia)
                     & new BsonDocumentFilterDefinition<LimiteSimbologia>(TenantHelpers.TenantFilter(tenantId));
        return db.Simbologias.Find(filter).FirstOrDefaultAsync(ct)!;
    }

    public async Task<LimiteSimbologia?> UpsertSimbologiaAsync(
        string simbologia,
        int? limite,
        string? tenantId,
        string? userId,
        CancellationToken ct = default)
    {
        var existing = await BuscarPorSimbologiaAsync(simbologia, tenantId, ct);
        var userOid = TenantHelpers.ToObjectId(userId);

        if (existing is not null)
        {
            if (limite is not null)
            {
                existing.Limite = limite.Value;
                existing.UpdatedBy = userOid ?? existing.UpdatedBy;
                await db.Simbologias.ReplaceOneAsync(s => s.Id == existing.Id, existing, cancellationToken: ct);
            }
            return existing;
        }

        if (limite is null) return null;

        var created = new LimiteSimbologia
        {
            Id = ObjectId.GenerateNewId(),
            Simbologia = simbologia,
            Limite = limite.Value,
            TenantId = TenantHelpers.ToObjectId(tenantId),
            CreatedBy = userOid,
            UpdatedBy = userOid,
        };
        await db.Simbologias.InsertOneAsync(created, cancellationToken: ct);
        return created;
    }

    public async Task<LimiteSimbologia?> UpdateLimiteAsync(
        string simbologia,
        int novoLimite,
        string? tenantId,
        CancellationToken ct = default)
    {
        var filter = Builders<LimiteSimbologia>.Filter.Eq(s => s.Simbologia, simbologia)
                     & new BsonDocumentFilterDefinition<LimiteSimbologia>(TenantHelpers.TenantFilter(tenantId));
        return await db.Simbologias.FindOneAndUpdateAsync(
            filter,
            Builders<LimiteSimbologia>.Update.Set(s => s.Limite, novoLimite),
            new FindOneAndUpdateOptions<LimiteSimbologia> { ReturnDocument = ReturnDocument.After },
            ct);
    }
}
