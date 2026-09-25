using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using MongoDB.Bson;

namespace Organograma.Application.Setores;

public sealed class CreateSetorDto
{
    public string Nome { get; set; } = "";
    public string Tipo { get; set; } = "";
    public string? Parent { get; set; }
}

public sealed class RenameSetorDto
{
    public string Nome { get; set; } = "";
}

public sealed class MoveSetorDto
{
    public string? Parent { get; set; }
}

public sealed class MoveAuditContext
{
    public string? TenantId { get; set; }
    public string? UserId { get; set; }
}

public sealed class SetoresService(
    ISetoresRepository setoresRepository,
    ICacheService cacheService,
    IAuditService auditService)
{
    public async Task<object> CreateSetorAsync(
        CreateSetorDto data,
        string? tenantId = null,
        string? userId = null,
        CancellationToken ct = default)
    {
        var nome = data.Nome;
        var tipo = data.Tipo;
        var parent = data.Parent;

        if (tipo == "Subsetor")
        {
            if (string.IsNullOrEmpty(parent))
                throw new AppException("Subsetor requer um nó pai", 400, "VALIDATION_ERROR");
            var parentNode = await setoresRepository.FindByIdAsync(parent, tenantId, ct);
            if (parentNode is null)
                throw new AppException("Nó pai não encontrado", 404, "NOT_FOUND");
        }

        var setor = new Setor
        {
            Id = ObjectId.GenerateNewId(),
            Nome = TextNormalizer.NormalizarTexto(nome),
            Tipo = tipo,
            Parent = string.IsNullOrEmpty(parent) ? null : TenantHelpers.ToObjectId(parent),
            TenantId = TenantHelpers.ToObjectId(tenantId),
            CreatedBy = TenantHelpers.ToObjectId(userId),
            CreatedAt = DateTime.UtcNow,
        };

        setor = await setoresRepository.CreateAsync(setor, ct);

        if (!string.IsNullOrEmpty(parent))
            await cacheService.ClearCacheForSetorAsync(parent, tenantId, ct);
        await cacheService.ClearCacheForSetorAsync(setor.Id.ToString(), tenantId, ct);

        return SetorMapper.ToApi(setor);
    }

    public async Task<object> GetSetoresOrganizadosAsync(string? tenantId = null, CancellationToken ct = default)
    {
        var cacheKey = tenantId is not null
            ? $"tenant:{tenantId}:setoresOrganizados"
            : "setoresOrganizados";

        return await cacheService.GetOrSetCacheAsync(cacheKey, async () =>
        {
            var setores = await setoresRepository.GetAllAsync(tenantId, ct);
            var funcionariosPorSetor = await setoresRepository.CountFuncionariosPorSetorAsync(tenantId, ct);
            var dicts = setores.Select(SetorMapper.ToDict).ToList();
            return OrganizarSetores.Build(dicts, funcionariosPorSetor);
        }, ct: ct);
    }

    public async Task<object> GetMainSetoresAsync(string? tenantId = null, CancellationToken ct = default)
    {
        var cacheKey = tenantId is not null
            ? $"tenant:{tenantId}:setores:null"
            : "setores:null";

        return await cacheService.GetOrSetCacheAsync(cacheKey, async () =>
        {
            var setores = await setoresRepository.FindMainSetoresAsync(tenantId, ct);
            return setores.Select(SetorMapper.ToApi).ToList();
        }, ct: ct);
    }

    public async Task<object> GetSetorDataAsync(string setorId, string? tenantId = null, CancellationToken ct = default)
    {
        var cacheKey = tenantId is not null
            ? $"tenant:{tenantId}:setor:{setorId}:dados"
            : $"setor:{setorId}:dados";

        return await cacheService.GetOrSetCacheAsync(cacheKey, async () =>
        {
            var subsetores = await setoresRepository.FindSetorDataAsync(setorId, tenantId, ct);
            return new { subsetores = subsetores.Select(SetorMapper.ToApi).ToList() };
        }, ct: ct);
    }

    public async Task<object> GetChildrenAsync(
        string? parentId = null,
        string? tenantId = null,
        CancellationToken ct = default)
    {
        var children = await setoresRepository.FindChildrenAsync(parentId, tenantId, ct);
        if (children.Count == 0) return Array.Empty<object>();

        var funcionariosPorSetor = await setoresRepository.CountFuncionariosPorSetorAsync(tenantId, ct);
        var descendantTasks = children
            .Select(c => setoresRepository.GetDescendantIdsAsync(c.Id.ToString(), tenantId, ct))
            .ToArray();
        var descendantIdLists = await Task.WhenAll(descendantTasks);

        var result = new List<Dictionary<string, object?>>();
        for (var i = 0; i < children.Count; i++)
        {
            var child = children[i];
            var obj = SetorMapper.ToDict(child);
            var ids = descendantIdLists[i];
            if (ids.Count == 0) ids = [child.Id];
            var subtree = ids.Sum(id =>
                funcionariosPorSetor.TryGetValue(id.ToString(), out var n) ? n : 0);
            var direct = funcionariosPorSetor.TryGetValue(child.Id.ToString(), out var d) ? d : 0;
            obj["quantidadeFuncionarios"] = direct;
            obj["quantidadeFuncionariosSubtree"] = subtree;
            obj["temFilhos"] = ids.Count > 1;
            result.Add(obj);
        }
        return result;
    }

    public async Task<object> RenameSetorAsync(
        string id,
        string nome,
        string? userId = null,
        string? tenantId = null,
        CancellationToken ct = default)
    {
        var normalizedName = TextNormalizer.NormalizarTexto(nome);
        var updatedBy = TenantHelpers.ToObjectId(userId);
        var setor = await setoresRepository.UpdateNomeAsync(id, normalizedName, updatedBy, tenantId, ct);
        if (setor is null)
            throw new AppException("Setor não encontrado", 404, "NOT_FOUND");

        if (setor.Parent is not null)
            await cacheService.ClearCacheForSetorAsync(setor.Parent.Value.ToString(), tenantId, ct);
        await cacheService.ClearCacheForSetorAsync(id, tenantId, ct);
        return SetorMapper.ToApi(setor);
    }

    public async Task<object> MoveSetorAsync(
        string id,
        string? parent,
        MoveAuditContext auditContext,
        CancellationToken ct = default)
    {
        var tenantId = auditContext.TenantId;
        var setor = await setoresRepository.FindByIdAsync(id, tenantId, ct);
        if (setor is null)
            throw new AppException("Setor não encontrado", 404, "NOT_FOUND");

        var previousParent = setor.Parent?.ToString();
        var nextParent = string.IsNullOrEmpty(parent) ? null : parent;

        if (previousParent == nextParent)
            return SetorMapper.ToApi(setor);

        if (nextParent == id)
            throw new AppException("Um nó não pode ser pai de si mesmo", 400, "VALIDATION_ERROR");

        if (nextParent is null)
        {
            if (setor.Tipo != "Setor")
                throw new AppException("Apenas Setor pode ser raiz (sem pai)", 400, "VALIDATION_ERROR");
        }
        else
        {
            var parentNode = await setoresRepository.FindByIdAsync(nextParent, tenantId, ct);
            if (parentNode is null)
                throw new AppException("Nó pai não encontrado", 404, "NOT_FOUND");

            var descendantIds = await setoresRepository.GetDescendantIdsAsync(id, tenantId, ct);
            var descendantSet = descendantIds.Select(d => d.ToString()).ToHashSet();
            if (descendantSet.Contains(nextParent))
                throw new AppException(
                    "Não é possível mover um nó para dentro da própria subárvore",
                    400,
                    "VALIDATION_ERROR");
        }

        var updatedBy = TenantHelpers.ToObjectId(auditContext.UserId);
        var nextParentOid = nextParent is null ? null : TenantHelpers.ToObjectId(nextParent);
        var updated = await setoresRepository.UpdateParentAsync(id, nextParentOid, updatedBy, tenantId, ct);

        if (previousParent is not null)
            await cacheService.ClearCacheForSetorAsync(previousParent, tenantId, ct);
        if (nextParent is not null)
            await cacheService.ClearCacheForSetorAsync(nextParent, tenantId, ct);
        await cacheService.ClearCacheForSetorAsync(id, tenantId, ct);

        _ = auditService.LogActionAsync(
            auditContext.TenantId,
            auditContext.UserId,
            "UPDATE",
            "setor",
            id,
            new
            {
                nome = updated?.Nome ?? setor.Nome,
                previousParent,
                nextParent,
            },
            ct);

        return SetorMapper.ToApi(updated ?? setor);
    }

    public async Task DeleteSetorAsync(string id, MoveAuditContext auditContext, CancellationToken ct = default)
    {
        var tenantId = auditContext.TenantId;
        var setor = await setoresRepository.FindByIdAsync(id, tenantId, ct);
        if (setor is null)
            throw new AppException("Setor não encontrado", 404, "NOT_FOUND");

        var descendantIds = await setoresRepository.GetDescendantIdsAsync(id, tenantId, ct);
        if (descendantIds.Count == 0)
            throw new AppException("Setor não encontrado", 404, "NOT_FOUND");

        var count = await setoresRepository.CountFuncionariosInSetoresAsync(descendantIds, ct);
        if (count > 0)
            throw new AppException(
                "Não é possível excluir: existem funcionários vinculados",
                409,
                "CONFLICT");

        await setoresRepository.DeleteWithChildrenAsync(id, tenantId, ct);
        await cacheService.ClearCacheForSetorAsync(id, tenantId, ct);

        _ = auditService.LogActionAsync(
            auditContext.TenantId,
            auditContext.UserId,
            "DELETE",
            "setor",
            id,
            new
            {
                nome = setor.Nome,
                descendantCount = descendantIds.Count,
            },
            ct);
    }
}
