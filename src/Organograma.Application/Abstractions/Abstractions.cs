using Organograma.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Organograma.Application.Abstractions;

public interface IAuthRepository
{
    Task<User?> FindUserByLoginIdAsync(string loginId, CancellationToken ct = default);
    Task<User?> FindUserForLoginAsync(string loginId, string? tenantId, CancellationToken ct = default);
    Task<User?> FindUserByMongoIdAsync(string id, CancellationToken ct = default);
    Task UpdateUserTokenAsync(string userId, string token, CancellationToken ct = default);
    Task InvalidateUserTokenAsync(string userId, CancellationToken ct = default);
}

public interface IUserRepository
{
    Task<IReadOnlyList<User>> FindAsync(BsonFilter filter, CancellationToken ct = default);
    Task<User?> FindOneAsync(BsonFilter filter, CancellationToken ct = default);
    Task<User> CreateAsync(User user, CancellationToken ct = default);
    Task<User> UpdateAsync(User user, CancellationToken ct = default);
    Task DeleteAsync(User user, CancellationToken ct = default);
    Task<long> CountOwnersAsync(MongoDB.Bson.ObjectId? tenantId, MongoDB.Bson.ObjectId excludeId, CancellationToken ct = default);
}

public interface ITenantsRepository
{
    Task<Tenant?> FindByIdAsync(string id, CancellationToken ct = default);
    Task<Tenant?> FindBySlugAsync(string slug, bool activeOnly = true, CancellationToken ct = default);
    Task<IReadOnlyList<Tenant>> ListAsync(CancellationToken ct = default);
    Task<Tenant> CreateAsync(Tenant tenant, CancellationToken ct = default);
    Task<Tenant> UpdateAsync(Tenant tenant, CancellationToken ct = default);
}

/// <summary>Opaque BSON filter document for repository queries.</summary>
public sealed class BsonFilter
{
    public MongoDB.Bson.BsonDocument Document { get; }

    public BsonFilter(MongoDB.Bson.BsonDocument document) => Document = document;

    public static BsonFilter Empty { get; } = new(new MongoDB.Bson.BsonDocument());

    public static BsonFilter From(MongoDB.Bson.BsonDocument document) => new(document);

    public BsonFilter And(MongoDB.Bson.BsonDocument other)
    {
        var merged = new MongoDB.Bson.BsonDocument(Document);
        foreach (var el in other.Elements)
            merged[el.Name] = el.Value;
        return new BsonFilter(merged);
    }
}

public interface ICacheService
{
    string VersionCounterKey(string? tenantId = null);
    string? ExtractTenantId(string key);
    string TenantKey(string? tenantId, string suffix);
    Task<string> GetVersionAsync(string? tenantId = null, CancellationToken ct = default);
    Task<long> BumpVersionAsync(string? tenantId = null, CancellationToken ct = default);
    Task<string> ResolveKeyAsync(string key, CancellationToken ct = default);
    Task<T> GetOrSetCacheAsync<T>(string key, Func<Task<T>> fetchFunction, int ttlSeconds = 3600, CancellationToken ct = default);
    Task ClearCacheForSetorAsync(string? id, string? tenantId = null, CancellationToken ct = default);
    Task ClearCacheForFuncionariosAsync(string? tenantId = null, CancellationToken ct = default);
    Task ClearCacheForDivisoesAsync(string? tenantId = null, CancellationToken ct = default);
    Task ClearCacheForCoordChangeAsync(string? tenantId, CancellationToken ct = default);
}

public interface IS3Service
{
    Task<string?> GerarUrlPreAssinadaAsync(string key, CancellationToken ct = default);
    Task<string> UploadFileAsync(Stream content, string contentType, string folder, string? tenantId = null, CancellationToken ct = default);
}

public sealed class AuditListResult
{
    public IReadOnlyList<object> Items { get; init; } = [];
    public long Total { get; init; }
    public int Limit { get; init; }
    public int Skip { get; init; }
}

public interface IAuditService
{
    Task LogActionAsync(
        string? tenantId,
        string? userId,
        string action,
        string entity,
        object? entityId,
        object? meta = null,
        CancellationToken ct = default);

    Task<AuditListResult> ListAsync(
        string? tenantId,
        int limit = 50,
        int skip = 0,
        bool isSuperadmin = false,
        CancellationToken ct = default);
}

public interface ISetoresRepository
{
    Task<IReadOnlyList<Setor>> GetAllAsync(string? tenantId, CancellationToken ct = default);
    Task<Setor?> FindByIdAsync(string id, string? tenantId, CancellationToken ct = default);
    Task<Setor> CreateAsync(Setor setor, CancellationToken ct = default);
    Task<IReadOnlyList<Setor>> FindMainSetoresAsync(string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<Setor>> FindChildrenAsync(string? parentId, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<Setor>> FindSetorDataAsync(string setorId, string? tenantId, CancellationToken ct = default);
    Task<Setor?> UpdateNomeAsync(string id, string nome, ObjectId? updatedBy, string? tenantId, CancellationToken ct = default);
    Task<Setor?> UpdateParentAsync(string id, ObjectId? parent, ObjectId? updatedBy, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<ObjectId>> GetDescendantIdsAsync(string id, string? tenantId, CancellationToken ct = default);
    Task<long> DeleteWithChildrenAsync(string id, string? tenantId, CancellationToken ct = default);
    Task<Dictionary<string, int>> CountFuncionariosPorSetorAsync(string? tenantId, CancellationToken ct = default);
    Task<long> CountFuncionariosInSetoresAsync(IReadOnlyList<ObjectId> setorIds, CancellationToken ct = default);
}

public interface ICargosComissionadosRepository
{
    Task<IReadOnlyList<BsonDocument>> BuscarTodosAsync(string? tenantId, CancellationToken ct = default);
    Task<CargoComissionado?> BuscarPorIdAsync(string id, string? tenantId, CancellationToken ct = default);
    Task<CargoComissionado?> BuscarPorNomeAsync(string nome, string? tenantId, CancellationToken ct = default);
    Task<CargoComissionado> CriarAsync(CargoComissionado cargo, CancellationToken ct = default);
    Task<CargoComissionado?> AtualizarAsync(string id, CargoComissionado patch, string? tenantId, CancellationToken ct = default);
    Task<CargoComissionado?> RemoverAsync(string id, string? tenantId, CancellationToken ct = default);
    Task<LimiteSimbologia?> BuscarPorSimbologiaAsync(string simbologia, string? tenantId, CancellationToken ct = default);
    Task<LimiteSimbologia?> UpsertSimbologiaAsync(
        string simbologia,
        int? limite,
        string? tenantId,
        string? userId,
        CancellationToken ct = default);
    Task<LimiteSimbologia?> UpdateLimiteAsync(string simbologia, int novoLimite, string? tenantId, CancellationToken ct = default);
}

public sealed class FuncionariosIdsQuery
{
    public IReadOnlyList<string>? SetorIds { get; set; }
    public string? SubtreeRoot { get; set; }
    public int Max { get; set; } = 10000;
}

public interface IFuncionariosRepository
{
    Task<Funcionario?> FindByNameAsync(string name, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<Funcionario>> FindByIdsAsync(IReadOnlyList<string> ids, string? tenantId, CancellationToken ct = default);
    Task<Funcionario?> FindByIdAsync(string id, string? tenantId, CancellationToken ct = default);
    Task<long> CountWithFiltersAsync(Organograma.Application.Funcionarios.ListFilters filters, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<Funcionario>> FindWithFiltersAsync(Organograma.Application.Funcionarios.ListFilters filters, int skip, int limit, string? tenantId, CancellationToken ct = default);
    Task<long> CountParaSelecaoAsync(Organograma.Application.Funcionarios.ListFilters filters, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<Funcionario>> FindParaSelecaoAsync(Organograma.Application.Funcionarios.ListFilters filters, int skip, int limit, string? tenantId, CancellationToken ct = default);
    Task<object> DistinctFiltrosSelecaoAsync(string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<Funcionario>> FindBySetoresFilteredAsync(IReadOnlyList<object> idsSetores, int skip, int limit, string? tenantId, Organograma.Application.Funcionarios.ListFilters filters, CancellationToken ct = default);
    Task<long> CountBySetoresExactAsync(IReadOnlyList<object> idsSetores, string? tenantId, Organograma.Application.Funcionarios.ListFilters filters, CancellationToken ct = default);
    Task<IReadOnlyList<ObjectId>> FindIdsOnlyAsync(Organograma.Application.Funcionarios.ListFilters filters, string? tenantId, FuncionariosIdsQuery query, CancellationToken ct = default);
    Task<Funcionario> CreateAsync(Funcionario data, CancellationToken ct = default);
    Task<Funcionario?> UpdateAsync(string id, BsonDocument setFields, string? tenantId, CancellationToken ct = default);
    Task<long> DeleteBatchAsync(IReadOnlyList<string> userIds, string? tenantId, CancellationToken ct = default);
    Task UpdateSetorIdAsync(IReadOnlyList<string> userIds, string newSetorId, string? tenantId, CancellationToken ct = default);
    Task<Funcionario?> UpdateObservacoesAsync(string userId, IReadOnlyList<BsonValue> observacoes, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<ObjectId>> GetDescendantSetorIdsAsync(object idsSetores, string? tenantId, CancellationToken ct = default);
    Task<long> CountBySetorAsync(object idsSetores, string? tenantId, Organograma.Application.Funcionarios.ListFilters filters, CancellationToken ct = default);
    Task<IReadOnlyList<Funcionario>> BuscarFuncionariosPorSetorAsync(object idSetor, int skip, int limit, string? tenantId, Organograma.Application.Funcionarios.ListFilters filters, CancellationToken ct = default);
    Task<IReadOnlyList<Funcionario>> FindForExportAsync(string? tenantId, IReadOnlyList<string>? ids, CancellationToken ct = default);
    Task<IReadOnlyList<Setor>> FindSetoresByIdsAsync(IReadOnlyList<object> ids, string? tenantId, CancellationToken ct = default);
}

public interface IReferenceLookup
{
    Task<Reference?> FindByIdAsync(string id, string? tenantId, CancellationToken ct = default);
    Task<Reference?> FindByNameAsync(string name, string? tenantId, CancellationToken ct = default);
}

public sealed class ReferenceNode
{
    public ObjectId Id { get; set; }
    public string Name { get; set; } = "";
    public string? Cargo { get; set; }
    public string? Telefone { get; set; }
    public string? Origem { get; set; }
    public ObjectId? FuncionarioId { get; set; }
    public ObjectId? ParentId { get; set; }
    public int? Depth { get; set; }
}

public sealed class FuncionarioTreeNode
{
    public ObjectId Id { get; set; }
    public string Nome { get; set; } = "";
    public string? Funcao { get; set; }
    public string? Secretaria { get; set; }
    public string? Natureza { get; set; }
    public ObjectId? ReferenciaId { get; set; }
}

public interface IReferenciasRepository
{
    string CacheKeyFor(string? tenantId);
    string TreeCacheKeyFor(string? tenantId);

    Task<Reference?> FindReferenceByNameAsync(string name, string? tenantId, CancellationToken ct = default);
    Task<Reference?> FindReferenceByFuncionarioIdAsync(string funcionarioId, string? tenantId, CancellationToken ct = default);
    Task<Reference?> FindReferenceByIdAsync(string id, string? tenantId, CancellationToken ct = default);
    Task<Reference> CreateReferenceAsync(Reference reference, CancellationToken ct = default);
    Task<IReadOnlyList<Reference>> GetAllReferencesAsync(string? tenantId, CancellationToken ct = default);
    Task<Reference?> UpdateReferenceByIdAsync(string id, BsonDocument setFields, string? tenantId, CancellationToken ct = default);
    Task<Reference?> DeleteReferenceByIdAsync(string id, string? tenantId, IClientSessionHandle? session = null, CancellationToken ct = default);

    Task<IReadOnlyList<ReferenceNode>> FindAncestorsAsync(string id, string? tenantId, CancellationToken ct = default);
    Task<(ReferenceNode? Root, IReadOnlyList<ReferenceNode> Referencias, IReadOnlyList<FuncionarioTreeNode> Funcionarios)> FindDescendantsAsync(
        string id, string? tenantId, CancellationToken ct = default);
    Task<(IReadOnlyList<ReferenceNode> Referencias, IReadOnlyList<FuncionarioTreeNode> Funcionarios)> FindAllForTreeAsync(
        string? tenantId, CancellationToken ct = default);
    Task<FuncionarioTreeNode?> FindFuncionarioByIdAsync(string id, string? tenantId, CancellationToken ct = default);
    Task<(long Referencias, long Funcionarios)> CountDirectChildrenAsync(string id, string? tenantId, CancellationToken ct = default);

    Task ReparentChildrenAsync(string fromId, ObjectId? toParentId, string? tenantId, IClientSessionHandle? session = null, CancellationToken ct = default);
    Task ReassignFuncionariosAsync(string fromId, (ObjectId Id, string Name)? toParent, string? tenantId, IClientSessionHandle? session = null, CancellationToken ct = default);
    Task RenameFuncionariosReferenciaAsync(string referenciaId, string name, string? tenantId, CancellationToken ct = default);

    Task<T> RunAtomicallyAsync<T>(Func<IClientSessionHandle?, CancellationToken, Task<T>> work, CancellationToken ct = default);
}

public sealed class BulkJobStatusDto
{
    public string JobId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Status { get; set; } = "queued";
    public object Progress { get; set; } = 0;
    public object? Result { get; set; }
    public string? Error { get; set; }
}

public interface IBulkJobService
{
    const int SyncThreshold = 200;

    Task<object> EnqueueDeleteUsersAsync(IReadOnlyList<string> userIds, string? tenantId, CancellationToken ct = default);
    Task<object> EnqueueExportCsvAsync(IReadOnlyList<string> ids, string? tenantId, CancellationToken ct = default);
    Task<BulkJobStatusDto?> GetJobStatusAsync(string jobId, CancellationToken ct = default);
}

public interface ISearchRepository
{
    Task<IReadOnlyList<ObjectId>> GetDescendantIdsAsync(object id, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<BsonDocument>> AutocompleteFuncionariosAsync(string termo, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<BsonDocument>> AutocompleteSetoresAsync(string termo, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<BsonDocument>> SearchSetoresAsync(string q, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<ObjectId>> FindFuncionarioIdsBySetorIdsAsync(IReadOnlyList<ObjectId> setorIds, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<ObjectId>> SearchFuncionariosDirectlyAsync(string q, string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<Funcionario>> GetFuncionariosByIdsAsync(IReadOnlyList<ObjectId> ids, string? tenantId, CancellationToken ct = default);
}

public sealed class ContratoBucketsDto
{
    public int In30 { get; init; }
    public int In31to60 { get; init; }
    public int In61to90 { get; init; }
    public int Expired { get; init; }
    public int Indeterminado { get; init; }
}

public interface IDashboardRepository
{
    Task<long> CountByTenantAsync(string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<object>> GroupByFieldAsync(string field, string? tenantId, int? topN = null, CancellationToken ct = default);
    Task<ContratoBucketsDto> CountContratosBucketsAsync(string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<object>> FindContratosAVencerAsync(string? tenantId, int withinDays = 90, int limit = 20, CancellationToken ct = default);
    Task<object> AggregatePayrollAsync(string? tenantId, int topSecretarias = 10, CancellationToken ct = default);
    Task<Dictionary<string, int>> CountOcupadasPorSimbologiaAsync(string? tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<LimiteSimbologia>> ListSimbologiasAsync(string? tenantId, CancellationToken ct = default);
}
