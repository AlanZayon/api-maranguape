using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using Organograma.Domain.Serialization;
using MongoDB.Bson;

namespace Organograma.Application.Funcionarios;

public sealed class FuncionariosService(
    IFuncionariosRepository funcionariosRepository,
    ICargosComissionadosRepository cargoLookup,
    LimiteService limiteService,
    ICacheService cacheService,
    IS3Service s3Service,
    IReferenceLookup referenceLookup)
{
    public const int DefaultListLimit = 50;
    public const int MaxListLimit = 200;
    private const int BatchSize = 100;
    private const int MaxBatchConcurrency = 2;

    private static int ClampLimit(int? limit, int fallback = DefaultListLimit)
    {
        if (limit is null or < 1) return fallback;
        return Math.Min(limit.Value, MaxListLimit);
    }

    private static int ClampPage(int? page)
        => page is null or < 1 ? 1 : page.Value;

    private static string TenantCachePrefix(string? tenantId)
        => tenantId is not null ? $"tenant:{tenantId}:" : "";

    private static string? LotacaoIdOf(Funcionario? f)
        => f is null ? null : f.SetorId.ToString();

    private static string EscapeCsv(object? value)
    {
        if (value is null) return "";
        var str = Convert.ToString(value) ?? "";
        if (str.IndexOfAny(['"', ',', '\n', '\r']) >= 0)
            return $"\"{str.Replace("\"", "\"\"")}\"";
        return str;
    }

    private async Task<Dictionary<string, object?>> ResolveReferenciaVinculoAsync(
        FuncionarioInput dto,
        string? tenantId,
        CancellationToken ct)
    {
        if (!dto.ReferenciaIdSpecified && !dto.ReferenciaSpecified) return new();

        if (dto.ReferenciaIdSpecified && !string.IsNullOrWhiteSpace(dto.ReferenciaId))
        {
            var referencia = await referenceLookup.FindByIdAsync(dto.ReferenciaId!, tenantId, ct);
            if (referencia is null)
                throw new AppException("Referência não encontrada.", 400, "BAD_REQUEST");
            return new Dictionary<string, object?>
            {
                ["referenciaId"] = referencia.Id,
                ["referencia"] = referencia.Name,
            };
        }

        var nome = (dto.Referencia ?? "").Trim();
        if (nome.Length == 0)
            return new Dictionary<string, object?> { ["referencia"] = null, ["referenciaId"] = null };

        var byName = await referenceLookup.FindByNameAsync(nome.ToUpperInvariant(), tenantId, ct);
        return new Dictionary<string, object?>
        {
            ["referencia"] = byName?.Name ?? nome,
            ["referenciaId"] = byName?.Id,
        };
    }

    private async Task<PaginatedFuncionarios> WithFotoUrlsAsync(PaginatedFuncionarios page, CancellationToken ct)
    {
        var list = new List<Dictionary<string, object?>>();
        foreach (var doc in page.Funcionarios)
        {
            var copy = new Dictionary<string, object?>(doc);
            var foto = copy.TryGetValue("foto", out var f) ? Convert.ToString(f) : null;
            string? fotoUrl = null;
            if (!string.IsNullOrEmpty(foto) && !System.Text.RegularExpressions.Regex.IsMatch(foto, @"^https?:\/\/", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                fotoUrl = await s3Service.GerarUrlPreAssinadaAsync(foto, ct);
            else if (copy.TryGetValue("fotoUrl", out var existing) && existing is string s)
                fotoUrl = s;
            else if (!string.IsNullOrEmpty(foto) && System.Text.RegularExpressions.Regex.IsMatch(foto, @"^https?:\/\/", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                fotoUrl = foto;
            copy["fotoUrl"] = fotoUrl;
            list.Add(copy);
        }
        page.Funcionarios = list;
        return page;
    }

    public async Task<PaginatedFuncionarios> BuscarFuncionariosAsync(
        int page, int limit, string? tenantId, ListFilters filters, CancellationToken ct = default)
    {
        var pageNum = ClampPage(page);
        var limitNum = ClampLimit(limit);
        var skip = (pageNum - 1) * limitNum;
        var filterKey = filters.HasActiveFilters() ? $":f:{System.Text.Json.JsonSerializer.Serialize(filters)}" : "";
        var cacheKey = $"{TenantCachePrefix(tenantId)}todos:funcionarios:page{pageNum}:l{limitNum}{filterKey}";

        var cached = await cacheService.GetOrSetCacheAsync(cacheKey, async () =>
        {
            var total = await funcionariosRepository.CountWithFiltersAsync(filters, tenantId, ct);
            var rows = await funcionariosRepository.FindWithFiltersAsync(filters, skip, limitNum, tenantId, ct);
            return new PaginatedFuncionarios
            {
                Funcionarios = rows.Select(f => FuncionarioMapper.ToDict(f)).ToList(),
                Total = total,
                Page = pageNum,
                Pages = Math.Max(1, (int)Math.Ceiling(total / (double)limitNum)),
            };
        }, ct: ct);

        return await WithFotoUrlsAsync(cached, ct);
    }

    public async Task<object> BuscarParaSelecaoAsync(
        string q, string natureza, string secretaria, string funcao,
        int page, int limit, bool incluirFiltros, string? tenantId, CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, page);
        var limitNum = Math.Min(50, Math.Max(1, limit));
        var skip = (pageNum - 1) * limitNum;
        var filters = new ListFilters { Q = q, Natureza = natureza, Secretaria = secretaria, Funcao = funcao };

        var total = await funcionariosRepository.CountParaSelecaoAsync(filters, tenantId, ct);
        var rows = await funcionariosRepository.FindParaSelecaoAsync(filters, skip, limitNum, tenantId, ct);
        object? filtros = incluirFiltros
            ? await funcionariosRepository.DistinctFiltrosSelecaoAsync(tenantId, ct)
            : null;

        var result = new PaginatedFuncionarios
        {
            Funcionarios = rows.Select(FuncionarioMapper.ToSelecaoDict).ToList(),
            Total = total,
            Page = pageNum,
            Pages = Math.Max(1, (int)Math.Ceiling(total / (double)limitNum)),
            Filtros = filtros,
        };
        return new
        {
            funcionarios = result.Funcionarios,
            total = result.Total,
            page = result.Page,
            pages = result.Pages,
            filtros = result.Filtros,
        };
    }

    public Task<object> GetFiltrosDisponiveisAsync(string? tenantId, CancellationToken ct = default)
    {
        var cacheKey = $"{TenantCachePrefix(tenantId)}funcionarios:filtros";
        return cacheService.GetOrSetCacheAsync(cacheKey,
            () => funcionariosRepository.DistinctFiltrosSelecaoAsync(tenantId, ct), ct: ct);
    }

    public async Task<object> GetMidiaUrlsAsync(string id, string? tenantId, CancellationToken ct = default)
    {
        var funcionario = await funcionariosRepository.FindByIdAsync(id, tenantId, ct)
            ?? throw new AppException("Funcionário não encontrado", 404, "NOT_FOUND");
        return new
        {
            fotoUrl = funcionario.Foto is not null
                ? await s3Service.GerarUrlPreAssinadaAsync(funcionario.Foto, ct)
                : null,
            arquivoUrl = funcionario.Arquivo is not null
                ? await s3Service.GerarUrlPreAssinadaAsync(funcionario.Arquivo, ct)
                : null,
        };
    }

    public async Task<object> BuscarIdsAsync(
        ListFilters filters,
        IReadOnlyList<string>? setorIds,
        string? subtreeRoot,
        int max,
        string? tenantId,
        CancellationToken ct = default)
    {
        var ids = await funcionariosRepository.FindIdsOnlyAsync(filters, tenantId, new FuncionariosIdsQuery
        {
            SetorIds = setorIds,
            SubtreeRoot = subtreeRoot,
            Max = max,
        }, ct);
        return new { ids = ids.Select(i => i.ToString()).ToList(), total = ids.Count };
    }

    public Task<PaginatedFuncionarios> BuscarFuncionariosPorCoordenadoriaAsync(
        string id, int page, int limit, string? tenantId, ListFilters filters, CancellationToken ct = default)
        => BuscarFuncionariosPorLotacaoAsync(id, page, limit, tenantId, filters, ct);

    public async Task<PaginatedFuncionarios> BuscarFuncionariosPorLotacaoAsync(
        string setorId, int page, int limit, string? tenantId, ListFilters filters, CancellationToken ct = default)
    {
        var pageNum = ClampPage(page);
        var limitNum = ClampLimit(limit);
        var filterKey = filters.HasActiveFilters() ? $":f:{System.Text.Json.JsonSerializer.Serialize(filters)}" : "";
        var cacheKey = $"{TenantCachePrefix(tenantId)}setor:{setorId}:funcionarios:page:{pageNum}:l{limitNum}{filterKey}";

        var cached = await cacheService.GetOrSetCacheAsync(cacheKey, async () =>
        {
            object oid = ObjectId.TryParse(setorId, out var o) ? o : setorId;
            var skip = (pageNum - 1) * limitNum;
            var total = await funcionariosRepository.CountBySetoresExactAsync([oid], tenantId, filters, ct);
            var rows = await funcionariosRepository.FindBySetoresFilteredAsync([oid], skip, limitNum, tenantId, filters, ct);
            return new PaginatedFuncionarios
            {
                Funcionarios = rows.Select(f => FuncionarioMapper.ToDict(f)).ToList(),
                Total = total,
                Page = pageNum,
                Pages = Math.Max(1, (int)Math.Ceiling(total / (double)limitNum)),
            };
        }, ct: ct);

        return await WithFotoUrlsAsync(cached, ct);
    }

    public async Task<PaginatedFuncionarios> BuscarFuncionariosPorSetorAsync(
        string idSetor, int page, int limit, string? tenantId, ListFilters filters, CancellationToken ct = default)
    {
        var pageNum = ClampPage(page);
        var limitNum = ClampLimit(limit);
        var filterKey = filters.HasActiveFilters() ? $":f:{System.Text.Json.JsonSerializer.Serialize(filters)}" : "";
        object oid = ObjectId.TryParse(idSetor, out var o) ? o : idSetor;

        var cached = await cacheService.GetOrSetCacheAsync(
            $"{TenantCachePrefix(tenantId)}setor:{idSetor}:subtree:page:{pageNum}:l{limitNum}{filterKey}",
            async () =>
            {
                var skip = (pageNum - 1) * limitNum;
                var total = await funcionariosRepository.CountBySetorAsync(oid, tenantId, filters, ct);
                var rows = await funcionariosRepository.BuscarFuncionariosPorSetorAsync(oid, skip, limitNum, tenantId, filters, ct);
                return new PaginatedFuncionarios
                {
                    Funcionarios = rows.Select(f => FuncionarioMapper.ToDict(f)).ToList(),
                    Total = total,
                    Page = pageNum,
                    Pages = Math.Max(1, (int)Math.Ceiling(total / (double)limitNum)),
                };
            }, ct: ct);

        return await WithFotoUrlsAsync(cached, ct);
    }

    public Task<PaginatedFuncionarios> BuscarFuncionariosPorDivisoesAsync(
        IReadOnlyList<string> ids, int page, int limit, string? tenantId, ListFilters filters, CancellationToken ct = default)
        => BuscarFuncionariosPorSetoresAsync(ids, page, limit, tenantId, filters, ct);

    public async Task<PaginatedFuncionarios> BuscarFuncionariosPorSetoresAsync(
        IReadOnlyList<string> idsSetores, int page, int limit, string? tenantId, ListFilters filters, CancellationToken ct = default)
    {
        var pageNum = ClampPage(page);
        var limitNum = ClampLimit(limit);
        var filterKey = filters.HasActiveFilters() ? $":f:{System.Text.Json.JsonSerializer.Serialize(filters)}" : "";

        var cached = await cacheService.GetOrSetCacheAsync(
            $"{TenantCachePrefix(tenantId)}setores:{string.Join("-", idsSetores)}:page{pageNum}:l{limitNum}{filterKey}",
            async () =>
            {
                var skip = (pageNum - 1) * limitNum;
                var asObjects = idsSetores.Cast<object>().ToList();
                var total = await funcionariosRepository.CountBySetoresExactAsync(asObjects, tenantId, filters, ct);
                var rows = await funcionariosRepository.FindBySetoresFilteredAsync(asObjects, skip, limitNum, tenantId, filters, ct);
                return new PaginatedFuncionarios
                {
                    Funcionarios = rows.Select(f => FuncionarioMapper.ToDict(f)).ToList(),
                    Total = total,
                    Page = pageNum,
                    Pages = Math.Max(1, (int)Math.Ceiling(total / (double)limitNum)),
                };
            }, ct: ct);

        return await WithFotoUrlsAsync(cached, ct);
    }

    public async Task<string> ExportCsvAsync(string? tenantId, IReadOnlyList<string>? ids, CancellationToken ct = default)
    {
        if (ids is null || ids.Count == 0)
            throw new AppException("Selecione ao menos um funcionário para exportar.", 400, "BAD_REQUEST");

        var rows = await funcionariosRepository.FindForExportAsync(tenantId, ids, ct);
        var lines = new List<string> { "nome,secretaria,funcao,natureza,referencia,salarioBruto" };
        foreach (var row in rows)
        {
            lines.Add(string.Join(",",
                EscapeCsv(row.Nome),
                EscapeCsv(row.Secretaria),
                EscapeCsv(row.Funcao),
                EscapeCsv(row.Natureza),
                EscapeCsv(row.Referencia),
                EscapeCsv(row.SalarioBruto)));
        }
        return "\uFEFF" + string.Join("\n", lines);
    }

    public async Task<Dictionary<string, object?>> CreateFuncionarioAsync(
        FuncionarioInput dto,
        Stream? fotoStream,
        string? fotoContentType,
        Stream? arquivoStream,
        string? arquivoContentType,
        string? tenantId,
        string? userId,
        CancellationToken ct = default)
    {
        string? fotoKey = null;
        string? arquivoKey = null;
        if (fotoStream is not null)
            fotoKey = await s3Service.UploadFileAsync(fotoStream, fotoContentType ?? "application/octet-stream", "fotos", tenantId, ct);
        if (arquivoStream is not null)
            arquivoKey = await s3Service.UploadFileAsync(arquivoStream, arquivoContentType ?? "application/octet-stream", "arquivos", tenantId, ct);

        if (dto.Natureza == "COMISSIONADO")
        {
            var cargo = await cargoLookup.BuscarPorNomeAsync(dto.Funcao, tenantId, ct)
                ?? throw new AppException("Cargo comissionado não encontrado.", 400, "BAD_REQUEST");
            var simbologia = await cargoLookup.BuscarPorSimbologiaAsync(cargo.Simbologia, tenantId, ct)
                ?? throw new AppException("Simbologia não encontrada para o cargo.", 400, "BAD_REQUEST");
            if (simbologia.Limite == 0)
                throw new AppException("Não é possível criar funcionário: limite atingido.", 400, "BAD_REQUEST");
            await cargoLookup.UpdateLimiteAsync(simbologia.Simbologia, simbologia.Limite - 1, tenantId, ct);
        }

        var setorId = dto.ResolveSetorId()
            ?? throw new AppException("Lotação (setorId) obrigatória.", 400, "BAD_REQUEST");
        if (!ObjectId.TryParse(setorId, out var setorOid))
            throw new AppException("Lotação (setorId) inválida.", 400, "BAD_REQUEST");

        var vinculo = await ResolveReferenciaVinculoAsync(dto, tenantId, ct);
        var obs = ObservacoesNormalizer.Normalize(dto.Observacoes);

        var entity = new Funcionario
        {
            Nome = dto.Nome,
            Secretaria = dto.Secretaria,
            Funcao = dto.Funcao,
            Tipo = dto.Tipo,
            Natureza = dto.Natureza,
            Referencia = vinculo.TryGetValue("referencia", out var refNome) ? Convert.ToString(refNome) : dto.Referencia,
            ReferenciaId = vinculo.TryGetValue("referenciaId", out var refId) && refId is ObjectId rid ? rid : null,
            RedesSociais = (dto.RedesSociais ?? []).Select(r => new RedeSocial { Link = r.Link, Nome = r.Nome }).ToList(),
            SalarioBruto = dto.SalarioBruto,
            Endereco = dto.Endereco,
            Cidade = dto.Cidade,
            Bairro = dto.Bairro,
            Telefone = dto.Telefone,
            Observacoes = ObservacoesNormalizer.ToBsonValues(obs),
            Foto = fotoKey,
            Arquivo = arquivoKey,
            SetorId = setorOid,
            InicioContrato = DateTime.TryParse(dto.InicioContrato, out var ini) ? ini.ToUniversalTime() : null,
            FimContrato = FimContrato.Parse(dto.FimContrato),
            TenantId = TenantHelpers.ToObjectId(tenantId),
            CreatedBy = TenantHelpers.ToObjectId(userId),
            CreatedAt = DateTime.UtcNow,
        };

        try
        {
            entity = await funcionariosRepository.CreateAsync(entity, ct);
        }
        catch (MongoDB.Driver.MongoWriteException ex) when (ex.WriteError?.Code == 11000)
        {
            throw new AppException(
                "Já existe um funcionário com esse nome ou outro campo único.",
                400,
                "DUPLICATE_KEY");
        }

        var setores = await funcionariosRepository.FindSetoresByIdsAsync([entity.SetorId], tenantId, ct);
        await cacheService.ClearCacheForFuncionariosAsync(tenantId, ct);

        var dict = FuncionarioMapper.ToDict(
            entity,
            fotoKey is not null ? await s3Service.GerarUrlPreAssinadaAsync(fotoKey, ct) : null,
            arquivoKey is not null ? await s3Service.GerarUrlPreAssinadaAsync(arquivoKey, ct) : null);
        _ = setores;
        return dict;
    }

    public async Task<Dictionary<string, object?>> UpdateFuncionarioAsync(
        string id,
        FuncionarioInput body,
        Stream? fotoStream,
        string? fotoContentType,
        Stream? arquivoStream,
        string? arquivoContentType,
        string? tenantId,
        string? updatedBy,
        CancellationToken ct = default)
    {
        var existentes = await funcionariosRepository.FindByIdsAsync([id], tenantId, ct);
        if (existentes.Count == 0)
            throw new AppException("Funcionário não encontrado", 404, "NOT_FOUND");

        var atual = existentes[0];
        if (body.Funcao != atual.Funcao)
        {
            await limiteService.AtualizarLimitesDeFuncaoAsync(
                atual.Funcao, body.Funcao, atual.Natureza, body.Natureza, tenantId, ct);
        }

        var fotoKey = fotoStream is not null
            ? await s3Service.UploadFileAsync(fotoStream, fotoContentType ?? "application/octet-stream", "fotos", tenantId, ct)
            : atual.Foto;
        var arquivoKey = arquivoStream is not null
            ? await s3Service.UploadFileAsync(arquivoStream, arquivoContentType ?? "application/octet-stream", "arquivos", tenantId, ct)
            : atual.Arquivo;

        var setorIdStr = body.ResolveSetorId() ?? LotacaoIdOf(atual);
        if (string.IsNullOrEmpty(setorIdStr) || !ObjectId.TryParse(setorIdStr, out var setorOid))
            throw new AppException("Lotação (setorId) obrigatória.", 400, "BAD_REQUEST");

        var vinculo = await ResolveReferenciaVinculoAsync(body, tenantId, ct);
        var set = new BsonDocument
        {
            ["nome"] = body.Nome,
            ["secretaria"] = body.Secretaria,
            ["funcao"] = body.Funcao,
            ["natureza"] = body.Natureza,
            ["salarioBruto"] = body.SalarioBruto,
            ["setorId"] = setorOid,
            ["foto"] = fotoKey is null ? BsonNull.Value : (BsonValue)fotoKey,
            ["arquivo"] = arquivoKey is null ? BsonNull.Value : (BsonValue)arquivoKey,
        };
        if (body.Tipo is not null) set["tipo"] = body.Tipo;
        if (body.Cidade is not null) set["cidade"] = body.Cidade;
        if (body.Endereco is not null) set["endereco"] = body.Endereco;
        if (body.Bairro is not null) set["bairro"] = body.Bairro;
        if (body.Telefone is not null) set["telefone"] = body.Telefone;
        if (body.RedesSociais is not null)
        {
            set["redesSociais"] = new BsonArray(body.RedesSociais.Select(r => new BsonDocument
            {
                ["link"] = r.Link,
                ["nome"] = r.Nome,
            }));
        }
        if (body.Observacoes is not null)
            set["observacoes"] = new BsonArray(ObservacoesNormalizer.ToBsonValues(ObservacoesNormalizer.Normalize(body.Observacoes)));
        if (body.InicioContrato is not null)
            set["inicioContrato"] = DateTime.TryParse(body.InicioContrato, out var ini)
                ? (BsonValue)ini.ToUniversalTime()
                : BsonNull.Value;
        if (body.FimContrato is not null)
        {
            var fim = FimContrato.Parse(body.FimContrato);
            if (fim is null || fim.IsNull) set["fimContrato"] = BsonNull.Value;
            else if (fim.IsIndeterminado) set["fimContrato"] = "indeterminado";
            else set["fimContrato"] = fim.Date!.Value;
        }
        foreach (var kv in vinculo)
        {
            if (kv.Value is null) set[kv.Key] = BsonNull.Value;
            else if (kv.Value is ObjectId oid) set[kv.Key] = oid;
            else set[kv.Key] = BsonValue.Create(kv.Value);
        }
        if (TenantHelpers.ToObjectId(updatedBy) is { } ub)
            set["updatedBy"] = ub;

        var updated = await funcionariosRepository.UpdateAsync(id, set, tenantId, ct)
            ?? throw new AppException("Funcionário não encontrado", 404, "NOT_FOUND");

        await cacheService.ClearCacheForFuncionariosAsync(tenantId, ct);

        return FuncionarioMapper.ToDict(
            updated,
            fotoKey is not null ? await s3Service.GerarUrlPreAssinadaAsync(fotoKey, ct) : null,
            arquivoKey is not null ? await s3Service.GerarUrlPreAssinadaAsync(arquivoKey, ct) : null);
    }

    public async Task<object> DeleteUsersAsync(IReadOnlyList<string> userIds, string? tenantId, CancellationToken ct = default)
    {
        var setoresAfetados = new HashSet<string>();
        var cargosComissionados = new Dictionary<string, int>();

        for (var i = 0; i < userIds.Count; i += BatchSize)
        {
            var batch = userIds.Skip(i).Take(BatchSize).ToList();
            var funcionarios = await funcionariosRepository.FindByIdsAsync(batch, tenantId, ct);
            foreach (var func in funcionarios)
            {
                var lotacao = LotacaoIdOf(func);
                if (lotacao is not null) setoresAfetados.Add(lotacao);
                if (func.Natureza == "COMISSIONADO" && !string.IsNullOrEmpty(func.Funcao))
                    cargosComissionados[func.Funcao] = cargosComissionados.GetValueOrDefault(func.Funcao) + 1;
            }
            await funcionariosRepository.DeleteBatchAsync(batch, tenantId, ct);
        }

        foreach (var (nomeFuncao, qtd) in cargosComissionados)
        {
            var cargo = await cargoLookup.BuscarPorNomeAsync(nomeFuncao, tenantId, ct);
            if (cargo?.Simbologia is { Length: > 0 })
            {
                var simb = await cargoLookup.BuscarPorSimbologiaAsync(cargo.Simbologia, tenantId, ct);
                await cargoLookup.UpdateLimiteAsync(cargo.Simbologia, (simb?.Limite ?? 0) + qtd, tenantId, ct);
            }
        }

        await cacheService.ClearCacheForFuncionariosAsync(tenantId, ct);
        return new { success = true, deleted = userIds.Count };
    }

    public async Task<IReadOnlyList<Dictionary<string, object?>>> UpdateLotacaoAsync(
        IReadOnlyList<string> userIds,
        string newSetorId,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (userIds.Count == 0)
            throw new AppException("Lista de usuários inválida.", 400, "BAD_REQUEST");
        if (string.IsNullOrWhiteSpace(newSetorId))
            throw new AppException("Setor de destino obrigatório.", 400, "BAD_REQUEST");

        var users = await funcionariosRepository.FindByIdsAsync(userIds, tenantId, ct);
        if (users.Count == 0)
            throw new AppException("Nenhum funcionário encontrado.", 404, "NOT_FOUND");

        await funcionariosRepository.UpdateSetorIdAsync(userIds, newSetorId, tenantId, ct);
        await cacheService.ClearCacheForCoordChangeAsync(tenantId, ct);

        var updated = await funcionariosRepository.FindByIdsAsync(userIds, tenantId, ct);
        return updated.Select(f => FuncionarioMapper.ToDict(f)).ToList();
    }

    public async Task<object> UpdateObservacoesAsync(
        string userId,
        IReadOnlyList<object?> observacoes,
        string? tenantId,
        CancellationToken ct = default)
    {
        var existing = await funcionariosRepository.FindByIdsAsync([userId], tenantId, ct);
        if (existing.Count == 0)
            throw new AppException("Usuário não encontrado.", 404, "NOT_FOUND");

        var normalized = ObservacoesNormalizer.Normalize(observacoes, assignMissingDate: true);
        var updated = await funcionariosRepository.UpdateObservacoesAsync(
            userId, ObservacoesNormalizer.ToBsonValues(normalized), tenantId, ct)
            ?? throw new AppException("Usuário não encontrado.", 404, "NOT_FOUND");

        await cacheService.ClearCacheForFuncionariosAsync(tenantId, ct);
        return FuncionarioMapper.ToDict(updated);
    }

    public async Task<object> CheckNameAvailabilityAsync(string? name, string? tenantId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length < 3)
            return new { available = true, message = "Digite pelo menos 3 caracteres" };

        var normalized = TextNormalizer.Normalize(name)!;
        var existing = await funcionariosRepository.FindByNameAsync(normalized, tenantId, ct);
        if (existing is not null)
            return new { available = false, message = "Já existe um funcionário ativo com este nome" };
        return new { available = true, message = "Nome disponível" };
    }

    public async Task<bool> HasFuncionariosAsync(string entityId, CancellationToken ct = default)
    {
        var setor = await funcionariosRepository.FindSetoresByIdsAsync([entityId], null, ct);
        if (setor.Count == 0)
            throw new AppException("Entidade não encontrada", 404, "NOT_FOUND");
        var count = await funcionariosRepository.CountBySetorAsync(entityId, null, new ListFilters(), ct);
        return count > 0;
    }

    public Task<IReadOnlyList<BsonDocument>> BuscarCargosAsync(string? tenantId, CancellationToken ct = default)
        => cargoLookup.BuscarTodosAsync(tenantId, ct);
}
