using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using MongoDB.Bson;

namespace Organograma.Application.Referencias;

public sealed class ReferenciasService(
    IReferenciasRepository referenciasRepository,
    ICacheService cacheService,
    IFuncionariosRepository funcionariosRepository)
{
    public async Task<object> RegisterReferenceAsync(
        RegisterReferenceDto payload,
        string? tenantId = null,
        string? userId = null,
        CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(payload.FuncionarioId))
        {
            await RegisterFromFuncionarioAsync(
                payload.FuncionarioId,
                tenantId,
                userId,
                payload.ParentId,
                ct);
        }
        else
        {
            await RegisterExternaAsync(payload, tenantId, userId, ct);
        }

        return new { message = "Referência registrada com sucesso!" };
    }

    public async Task<Reference> RegisterFromFuncionarioAsync(
        string funcionarioId,
        string? tenantId = null,
        string? userId = null,
        string? parentId = null,
        CancellationToken ct = default)
    {
        var funcionario = await funcionariosRepository.FindByIdAsync(funcionarioId, tenantId, ct)
            ?? throw new AppException("Funcionário não encontrado!", 404, "NOT_FOUND");

        var alreadyLinked = await referenciasRepository.FindReferenceByFuncionarioIdAsync(
            funcionarioId, tenantId, ct);
        if (alreadyLinked is not null)
            throw new AppException("Este funcionário já está cadastrado como referência!", 400, "DUPLICATE");

        var name = (funcionario.Nome ?? "").Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(name))
            throw new AppException("Funcionário sem nome válido!", 400, "VALIDATION_ERROR");

        var existingByName = await referenciasRepository.FindReferenceByNameAsync(name, tenantId, ct);
        if (existingByName is not null)
            throw new AppException("Já existe uma referência com este nome!", 400, "DUPLICATE");

        var parent = await ResolveParentAsync(parentId, tenantId, ct);

        var created = await referenciasRepository.CreateReferenceAsync(new Reference
        {
            Id = ObjectId.GenerateNewId(),
            Name = name,
            Cargo = string.IsNullOrWhiteSpace(funcionario.Funcao)
                ? null
                : funcionario.Funcao.ToUpperInvariant(),
            Telefone = string.IsNullOrWhiteSpace(funcionario.Telefone)
                ? null
                : funcionario.Telefone.Trim(),
            Origem = "funcionario",
            FuncionarioId = funcionario.Id,
            ParentId = parent?.Id,
            TenantId = TenantHelpers.ToObjectId(tenantId),
            CreatedBy = TenantHelpers.ToObjectId(userId),
        }, ct);

        await cacheService.BumpVersionAsync(tenantId, ct);
        return created;
    }

    public async Task<Reference> RegisterExternaAsync(
        RegisterReferenceDto payload,
        string? tenantId = null,
        string? userId = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(payload.Name))
            throw new AppException("Todos os campos são obrigatórios!", 400, "VALIDATION_ERROR");

        var normalizedName = payload.Name.Trim().ToUpperInvariant();
        var normalizedCargo = string.IsNullOrWhiteSpace(payload.Cargo)
            ? null
            : payload.Cargo.Trim().ToUpperInvariant();
        var normalizedTelefone = string.IsNullOrWhiteSpace(payload.Telefone)
            ? null
            : payload.Telefone.Trim();

        var existing = await referenciasRepository.FindReferenceByNameAsync(normalizedName, tenantId, ct);
        if (existing is not null)
            throw new AppException("Já existe uma referência com este nome e sobrenome!", 400, "DUPLICATE");

        var parent = await ResolveParentAsync(payload.ParentId, tenantId, ct);

        // Do not set FuncionarioId — unique index is partial on ObjectId.
        var created = await referenciasRepository.CreateReferenceAsync(new Reference
        {
            Id = ObjectId.GenerateNewId(),
            Name = normalizedName,
            Cargo = normalizedCargo,
            Telefone = normalizedTelefone,
            Origem = "externa",
            ParentId = parent?.Id,
            TenantId = TenantHelpers.ToObjectId(tenantId),
            CreatedBy = TenantHelpers.ToObjectId(userId),
        }, ct);

        await cacheService.BumpVersionAsync(tenantId, ct);
        return created;
    }

    public Task<IReadOnlyList<object>> GetReferencesAsync(string? tenantId = null, CancellationToken ct = default)
        => cacheService.GetOrSetCacheAsync(
            referenciasRepository.CacheKeyFor(tenantId),
            async () =>
            {
                var docs = await referenciasRepository.GetAllReferencesAsync(tenantId, ct);
                return (IReadOnlyList<object>)docs.Select(ToApi).ToList();
            },
            ct: ct);

    public Task<IReadOnlyList<TreeNode>> GetTreeAsync(string? tenantId = null, CancellationToken ct = default)
        => cacheService.GetOrSetCacheAsync(
            referenciasRepository.TreeCacheKeyFor(tenantId),
            async () =>
            {
                var (referencias, funcionarios) =
                    await referenciasRepository.FindAllForTreeAsync(tenantId, ct);
                return TreeBuilder.BuildTree(referencias, funcionarios);
            },
            ct: ct);

    public async Task<object> GetAncestorsAsync(string id, string? tenantId = null, CancellationToken ct = default)
    {
        var reference = await referenciasRepository.FindReferenceByIdAsync(id, tenantId, ct)
            ?? throw new AppException("Referência não encontrada!", 404, "NOT_FOUND");

        var ancestors = await referenciasRepository.FindAncestorsAsync(id, tenantId, ct);
        var cadeia = ancestors
            .Select(TreeBuilder.ReferenceToNode)
            .Append(TreeBuilder.ReferenceToNode(ToNode(reference)))
            .ToList();

        return new
        {
            cadeia,
            raiz = cadeia.Count > 0 ? cadeia[0] : null,
            alvo = cadeia.Count > 0 ? cadeia[^1] : null,
        };
    }

    public async Task<object> GetDescendantsAsync(string id, string? tenantId = null, CancellationToken ct = default)
    {
        var (root, referencias, funcionarios) =
            await referenciasRepository.FindDescendantsAsync(id, tenantId, ct);
        if (root is null)
            throw new AppException("Referência não encontrada!", 404, "NOT_FOUND");

        var allRefs = new List<ReferenceNode> { root };
        allRefs.AddRange(referencias);
        var arvore = TreeBuilder.BuildTree(allRefs, funcionarios, root.Id.ToString());
        return new { arvore = arvore.Count > 0 ? arvore[0] : null };
    }

    public async Task<object> GetFuncionarioChainAsync(
        string funcionarioId,
        string? tenantId = null,
        CancellationToken ct = default)
    {
        var funcionario = await referenciasRepository.FindFuncionarioByIdAsync(funcionarioId, tenantId, ct)
            ?? throw new AppException("Funcionário não encontrado!", 404, "NOT_FOUND");

        var alvo = TreeBuilder.FuncionarioToNode(funcionario);
        if (funcionario.ReferenciaId is null)
            return new { cadeia = new[] { alvo }, raiz = (TreeNode?)null, alvo };

        var ancestorsTask = referenciasRepository.FindAncestorsAsync(
            funcionario.ReferenciaId.Value.ToString(), tenantId, ct);
        var referenciaTask = referenciasRepository.FindReferenceByIdAsync(
            funcionario.ReferenciaId.Value.ToString(), tenantId, ct);
        await Task.WhenAll(ancestorsTask, referenciaTask);

        var referencia = await referenciaTask;
        if (referencia is null)
            return new { cadeia = new[] { alvo }, raiz = (TreeNode?)null, alvo };

        var ancestors = await ancestorsTask;
        var cadeia = ancestors
            .Select(TreeBuilder.ReferenceToNode)
            .Append(TreeBuilder.ReferenceToNode(ToNode(referencia)))
            .Append(alvo)
            .ToList();

        return new { cadeia, raiz = cadeia[0], alvo };
    }

    public async Task<object> GetDeletionImpactAsync(string id, string? tenantId = null, CancellationToken ct = default)
    {
        var reference = await referenciasRepository.FindReferenceByIdAsync(id, tenantId, ct)
            ?? throw new AppException("Referência não encontrada!", 404, "NOT_FOUND");

        var childrenTask = referenciasRepository.CountDirectChildrenAsync(id, tenantId, ct);
        var parentTask = reference.ParentId is not null
            ? referenciasRepository.FindReferenceByIdAsync(reference.ParentId.Value.ToString(), tenantId, ct)
            : Task.FromResult<Reference?>(null);
        await Task.WhenAll(childrenTask, parentTask);

        var (refCount, funcCount) = await childrenTask;
        var parent = await parentTask;

        return new
        {
            referencia = TreeBuilder.ReferenceToNode(ToNode(reference)),
            novoParent = parent is not null
                ? new { id = parent.Id.ToString(), name = parent.Name }
                : null,
            filhos = new { referencias = refCount, funcionarios = funcCount },
        };
    }

    public async Task<object> UpdateReferenceAsync(
        string id,
        UpdateReferenceDto payload,
        string? tenantId = null,
        string? userId = null,
        CancellationToken ct = default)
    {
        var reference = await referenciasRepository.FindReferenceByIdAsync(id, tenantId, ct)
            ?? throw new AppException("Referência não encontrada!", 404, "NOT_FOUND");

        var set = new BsonDocument();
        string? renamedTo = null;

        if (payload.Name is not null)
        {
            var normalizedName = payload.Name.Trim().ToUpperInvariant();
            if (string.IsNullOrEmpty(normalizedName))
                throw new AppException("Nome da referência é obrigatório!", 400, "VALIDATION_ERROR");

            if (normalizedName != reference.Name)
            {
                var duplicate = await referenciasRepository.FindReferenceByNameAsync(normalizedName, tenantId, ct);
                if (duplicate is not null && duplicate.Id.ToString() != id)
                    throw new AppException("Já existe uma referência com este nome!", 400, "DUPLICATE");

                set["name"] = normalizedName;
                renamedTo = normalizedName;
            }
        }

        if (payload.Cargo is not null)
        {
            var cargo = payload.Cargo.Trim().ToUpperInvariant();
            if (!string.IsNullOrEmpty(cargo))
                set["cargo"] = cargo;
        }

        if (payload.Telefone is not null)
        {
            var telefone = payload.Telefone.Trim();
            if (!string.IsNullOrEmpty(telefone))
                set["telefone"] = telefone;
        }

        if (payload.ParentIdSpecified)
        {
            if (string.IsNullOrEmpty(payload.ParentId))
            {
                set["parentId"] = BsonNull.Value;
            }
            else
            {
                await ResolveParentAsync(payload.ParentId, tenantId, ct);
                await AssertNoCycleAsync(id, payload.ParentId, tenantId, ct);
                var parentOid = TenantHelpers.ToObjectId(payload.ParentId)
                    ?? throw new AppException("Referência indicadora não encontrada!", 404, "NOT_FOUND");
                set["parentId"] = parentOid;
            }
        }

        if (set.ElementCount == 0)
            return ToApi(reference);

        var userOid = TenantHelpers.ToObjectId(userId);
        if (userOid is not null)
            set["updatedBy"] = userOid.Value;

        var updated = await referenciasRepository.UpdateReferenceByIdAsync(id, set, tenantId, ct)
                      ?? reference;

        if (renamedTo is not null)
            await referenciasRepository.RenameFuncionariosReferenciaAsync(id, renamedTo, tenantId, ct);

        await cacheService.BumpVersionAsync(tenantId, ct);
        return ToApi(updated);
    }

    public async Task DeleteReferenceAsync(string id, string? tenantId = null, CancellationToken ct = default)
    {
        var reference = await referenciasRepository.FindReferenceByIdAsync(id, tenantId, ct)
            ?? throw new AppException("Referência não encontrada!", 404, "NOT_FOUND");

        Reference? parent = null;
        if (reference.ParentId is not null)
        {
            parent = await referenciasRepository.FindReferenceByIdAsync(
                reference.ParentId.Value.ToString(), tenantId, ct);
        }

        ObjectId? newParentId = parent?.Id;

        await referenciasRepository.RunAtomicallyAsync<object?>(async (session, token) =>
        {
            // Children are reparented before delete so a mid-path failure never
            // leaves nodes pointing at a missing document.
            await referenciasRepository.ReparentChildrenAsync(id, newParentId, tenantId, session, token);
            await referenciasRepository.ReassignFuncionariosAsync(
                id,
                parent is not null ? (parent.Id, parent.Name) : null,
                tenantId,
                session,
                token);
            await referenciasRepository.DeleteReferenceByIdAsync(id, tenantId, session, token);
            return null;
        }, ct);

        await cacheService.BumpVersionAsync(tenantId, ct);
    }

    private async Task AssertNoCycleAsync(
        string id,
        string newParentId,
        string? tenantId,
        CancellationToken ct)
    {
        if (string.Equals(id, newParentId, StringComparison.Ordinal))
            throw new AppException("Uma referência não pode indicar a si mesma!", 400, "CYCLE");

        var parentAncestors = await referenciasRepository.FindAncestorsAsync(newParentId, tenantId, ct);
        if (parentAncestors.Any(a => a.Id.ToString() == id))
        {
            throw new AppException(
                "Ciclo detectado: a referência não pode ser indicada por um de seus descendentes!",
                400,
                "CYCLE");
        }
    }

    private async Task<Reference?> ResolveParentAsync(
        string? parentId,
        string? tenantId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(parentId)) return null;
        var parent = await referenciasRepository.FindReferenceByIdAsync(parentId, tenantId, ct);
        if (parent is null)
            throw new AppException("Referência indicadora não encontrada!", 404, "NOT_FOUND");
        return parent;
    }

    private static ReferenceNode ToNode(Reference r) => new()
    {
        Id = r.Id,
        Name = r.Name,
        Cargo = r.Cargo,
        Telefone = r.Telefone,
        Origem = r.Origem,
        FuncionarioId = r.FuncionarioId,
        ParentId = r.ParentId,
    };

    internal static object ToApi(Reference r) => new
    {
        _id = r.Id.ToString(),
        name = r.Name,
        cargo = r.Cargo,
        telefone = r.Telefone,
        origem = r.Origem,
        funcionarioId = r.FuncionarioId?.ToString(),
        parentId = r.ParentId?.ToString(),
        tenantId = r.TenantId?.ToString(),
        createdBy = r.CreatedBy?.ToString(),
        updatedBy = r.UpdatedBy?.ToString(),
    };
}
