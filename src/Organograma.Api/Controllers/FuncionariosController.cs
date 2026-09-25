using System.Text.Json;
using Organograma.Api.Auth;
using Organograma.Application.Abstractions;
using Organograma.Application.Funcionarios;
using Organograma.Domain;
using Microsoft.AspNetCore.Mvc;

namespace Organograma.Api.Controllers;

[ApiController]
[Route("api/funcionarios")]
[AuthGuard]
public sealed class FuncionariosController(
    FuncionariosService funcionariosService,
    IBulkJobService bulkJobService) : ControllerBase
{
    private string? TenantId => HttpContext.GetTenantId();
    private AuthUser? CurrentAuthUser => HttpContext.GetAuthUser();

    private static ListFilters FiltersFromQuery(IQueryCollection query) => new()
    {
        Q = query["q"].ToString(),
        Natureza = query["natureza"].ToString(),
        Secretaria = query["secretaria"].ToString(),
        Funcao = query["funcao"].ToString(),
        Bairro = query["bairro"].ToString(),
        Referencia = query["referencia"].ToString(),
    };

    private static ListFilters FiltersFromBody(JsonElement body)
    {
        string S(string key) =>
            body.TryGetProperty(key, out var p) && p.ValueKind == JsonValueKind.String
                ? p.GetString() ?? ""
                : body.TryGetProperty(key, out var p2) ? p2.ToString() : "";

        return new ListFilters
        {
            Q = S("q"),
            Natureza = S("natureza"),
            Secretaria = S("secretaria"),
            Funcao = S("funcao"),
            Bairro = S("bairro"),
            Referencia = S("referencia"),
        };
    }

    private static FuncionarioInput InputFromRequest(HttpRequest request)
    {
        if (request.HasFormContentType)
        {
            var map = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in request.Form)
                map[kv.Key] = kv.Value.ToString();
            return FuncionarioInput.FromStringMap(map);
        }

        // JSON body — read once
        using var doc = JsonDocument.Parse(request.Body);
        var map2 = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            map2[prop.Name] = prop.Value.ValueKind switch
            {
                JsonValueKind.String => prop.Value.GetString(),
                JsonValueKind.Number => prop.Value.ToString(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                JsonValueKind.Null => null,
                _ => prop.Value.GetRawText(),
            };
        }
        return FuncionarioInput.FromStringMap(map2);
    }

    private static object PaginatedResponse(PaginatedFuncionarios p) => new
    {
        funcionarios = p.Funcionarios,
        total = p.Total,
        page = p.Page,
        pages = p.Pages,
    };

    [HttpGet("buscarFuncionarios")]
    public async Task<IActionResult> BuscarFuncionarios(CancellationToken ct)
    {
        var page = int.TryParse(Request.Query["page"], out var p) ? p : 1;
        var limit = int.TryParse(Request.Query["limit"], out var l) ? l : 50;
        var result = await funcionariosService.BuscarFuncionariosAsync(
            page, limit, TenantId, FiltersFromQuery(Request.Query), ct);
        return Ok(PaginatedResponse(result));
    }

    [HttpGet("para-selecao")]
    public async Task<IActionResult> BuscarParaSelecao(CancellationToken ct)
    {
        var q = Request.Query;
        var incluirFiltros =
            q["incluirFiltros"] == "1"
            || q["incluirFiltros"] == "true"
            || !q.ContainsKey("page")
            || q["page"] == "1";

        var page = int.TryParse(q["page"], out var p) ? p : 1;
        var limit = int.TryParse(q["limit"], out var l) ? l : 15;

        var result = await funcionariosService.BuscarParaSelecaoAsync(
            q["q"].ToString(),
            q["natureza"].ToString(),
            q["secretaria"].ToString(),
            q["funcao"].ToString(),
            page,
            limit,
            incluirFiltros,
            TenantId,
            ct);
        return Ok(result);
    }

    [HttpGet("filtros-disponiveis")]
    public async Task<IActionResult> GetFiltrosDisponiveis(CancellationToken ct)
        => Ok(await funcionariosService.GetFiltrosDisponiveisAsync(TenantId, ct));

    [HttpGet("jobs/{jobId}")]
    public async Task<IActionResult> GetJob(string jobId, CancellationToken ct)
    {
        var status = await bulkJobService.GetJobStatusAsync(jobId, ct)
            ?? throw new AppException("Job não encontrado.", 404, "NOT_FOUND");
        return Ok(new
        {
            jobId = status.JobId,
            name = status.Name,
            status = status.Status,
            progress = status.Progress,
            result = status.Result,
            error = status.Error,
        });
    }

    [HttpGet("{id}/midia")]
    public async Task<IActionResult> GetMidia(string id, CancellationToken ct)
        => Ok(await funcionariosService.GetMidiaUrlsAsync(id, TenantId, ct));

    [HttpPost("ids")]
    [Roles(Roles.Owner, Roles.Admin, Roles.User)]
    public async Task<IActionResult> BuscarIds([FromBody] JsonElement body, CancellationToken ct)
    {
        List<string>? setorIds = null;
        if (body.TryGetProperty("ids", out var idsEl) && idsEl.ValueKind == JsonValueKind.Array)
            setorIds = idsEl.EnumerateArray().Select(e => e.GetString()!).Where(s => s is not null).ToList()!;
        else if (body.TryGetProperty("setorIds", out var setorEl) && setorEl.ValueKind == JsonValueKind.Array)
            setorIds = setorEl.EnumerateArray().Select(e => e.GetString()!).Where(s => s is not null).ToList()!;

        var subtreeRoot = body.TryGetProperty("subtreeRoot", out var sr) ? sr.GetString() : null;
        var max = body.TryGetProperty("max", out var m) && m.TryGetInt32(out var mi) ? mi : 10000;

        return Ok(await funcionariosService.BuscarIdsAsync(
            FiltersFromBody(body), setorIds, subtreeRoot, max, TenantId, ct));
    }

    [HttpGet("buscarFuncionariosPorCoordenadoria/{coordId}")]
    public async Task<IActionResult> BuscarPorCoordenadoria(string coordId, CancellationToken ct)
    {
        var page = int.TryParse(Request.Query["page"], out var p) ? p : 1;
        var limit = int.TryParse(Request.Query["limit"], out var l) ? l : 50;
        var result = await funcionariosService.BuscarFuncionariosPorCoordenadoriaAsync(
            coordId, page, limit, TenantId, FiltersFromQuery(Request.Query), ct);
        return Ok(PaginatedResponse(result));
    }

    [HttpGet("buscarFuncionariosPorSetorId/{setorId}")]
    public Task<IActionResult> BuscarPorSetorIdAlias(string setorId, CancellationToken ct)
        => BuscarPorCoordenadoria(setorId, ct);

    [HttpGet("setores/{idSetor}/funcionarios")]
    public async Task<IActionResult> BuscarPorSetor(string idSetor, CancellationToken ct)
    {
        var page = int.TryParse(Request.Query["page"], out var p) ? p : 1;
        var limit = int.TryParse(Request.Query["limit"], out var l) ? l : 50;
        var result = await funcionariosService.BuscarFuncionariosPorSetorAsync(
            idSetor, page, limit, TenantId, FiltersFromQuery(Request.Query), ct);
        return Ok(PaginatedResponse(result));
    }

    [HttpPost]
    [Roles(Roles.Owner, Roles.Admin, Roles.User)]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> Create(CancellationToken ct)
    {
        await Request.ReadFormAsync(ct);
        var input = InputFromRequest(Request);
        IFormFile? foto = Request.Form.Files.GetFile("foto");
        IFormFile? arquivo = Request.Form.Files.GetFile("arquivo");

        Stream? fotoStream = foto is not null ? foto.OpenReadStream() : null;
        Stream? arquivoStream = arquivo is not null ? arquivo.OpenReadStream() : null;
        try
        {
            var created = await funcionariosService.CreateFuncionarioAsync(
                input,
                fotoStream,
                foto?.ContentType,
                arquivoStream,
                arquivo?.ContentType,
                TenantId,
                CurrentAuthUser?.Id,
                ct);
            return Ok(created);
        }
        finally
        {
            fotoStream?.Dispose();
            arquivoStream?.Dispose();
        }
    }

    [HttpPut("edit-funcionario/{id}")]
    [Roles(Roles.Owner, Roles.Admin, Roles.User)]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> Update(string id, CancellationToken ct)
    {
        FuncionarioInput input;
        IFormFile? foto = null;
        IFormFile? arquivo = null;

        if (Request.HasFormContentType)
        {
            await Request.ReadFormAsync(ct);
            input = InputFromRequest(Request);
            foto = Request.Form.Files.GetFile("foto");
            arquivo = Request.Form.Files.GetFile("arquivo");
        }
        else
        {
            input = InputFromRequest(Request);
        }

        Stream? fotoStream = foto is not null ? foto.OpenReadStream() : null;
        Stream? arquivoStream = arquivo is not null ? arquivo.OpenReadStream() : null;
        try
        {
            var updated = await funcionariosService.UpdateFuncionarioAsync(
                id, input, fotoStream, foto?.ContentType, arquivoStream, arquivo?.ContentType,
                TenantId, null, ct);
            return Ok(updated);
        }
        finally
        {
            fotoStream?.Dispose();
            arquivoStream?.Dispose();
        }
    }

    [HttpDelete("delete-users")]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public async Task<IActionResult> DeleteUsers([FromBody] JsonElement body, CancellationToken ct)
    {
        if (!body.TryGetProperty("userIds", out var idsEl) || idsEl.ValueKind != JsonValueKind.Array)
            throw new AppException("userIds é obrigatório.", 400, "BAD_REQUEST");

        var userIds = idsEl.EnumerateArray().Select(e => e.GetString()!).Where(s => !string.IsNullOrEmpty(s)).ToList();
        if (userIds.Count == 0)
            throw new AppException("userIds é obrigatório.", 400, "BAD_REQUEST");

        if (userIds.Count > IBulkJobService.SyncThreshold)
            return Ok(await bulkJobService.EnqueueDeleteUsersAsync(userIds, TenantId, ct));

        return Ok(await funcionariosService.DeleteUsersAsync(userIds, TenantId, ct));
    }

    [HttpPut("editar-coordenadoria-usuario")]
    [Roles(Roles.Owner, Roles.Admin, Roles.User)]
    public async Task<IActionResult> UpdateCoordenadoria([FromBody] JsonElement body, CancellationToken ct)
    {
        var usuariosIds = body.GetProperty("usuariosIds").EnumerateArray()
            .Select(e => e.GetString()!).Where(s => !string.IsNullOrEmpty(s)).ToList();
        string? destino = null;
        if (body.TryGetProperty("setorId", out var s) && s.ValueKind == JsonValueKind.String)
            destino = s.GetString();
        else if (body.TryGetProperty("coordenadoriaId", out var c) && c.ValueKind == JsonValueKind.String)
            destino = c.GetString();
        else if (body.TryGetProperty("lotacaoId", out var l) && l.ValueKind == JsonValueKind.String)
            destino = l.GetString();

        return Ok(await funcionariosService.UpdateLotacaoAsync(usuariosIds, destino ?? "", TenantId, ct));
    }

    [HttpPut("editar-lotacao-usuario")]
    [Roles(Roles.Owner, Roles.Admin, Roles.User)]
    public Task<IActionResult> UpdateLotacao([FromBody] JsonElement body, CancellationToken ct)
        => UpdateCoordenadoria(body, ct);

    [HttpPut("observacoes/{userId}")]
    [Roles(Roles.Owner, Roles.Admin, Roles.User)]
    public async Task<IActionResult> UpdateObservacoes(string userId, [FromBody] JsonElement body, CancellationToken ct)
    {
        var obs = new List<object?>();
        if (body.TryGetProperty("observacoes", out var o) && o.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in o.EnumerateArray())
            {
                obs.Add(el.ValueKind switch
                {
                    JsonValueKind.String => el.GetString(),
                    JsonValueKind.Object => el.EnumerateObject()
                        .ToDictionary(p => p.Name, p => (object?)(p.Value.ValueKind == JsonValueKind.String
                            ? p.Value.GetString()
                            : p.Value.GetRawText())),
                    _ => el.GetRawText(),
                });
            }
        }

        var user = await funcionariosService.UpdateObservacoesAsync(userId, obs, TenantId, ct);
        var dict = (Dictionary<string, object?>)user;
        return Ok(new
        {
            message = "Observações atualizadas com sucesso.",
            observacoes = dict.GetValueOrDefault("observacoes"),
        });
    }

    [HttpGet("buscarCargos")]
    public async Task<IActionResult> BuscarCargos(CancellationToken ct)
        => Ok(await funcionariosService.BuscarCargosAsync(TenantId, ct));

    [HttpGet("check-name")]
    public async Task<IActionResult> CheckName([FromQuery] string? name, CancellationToken ct)
        => Ok(await funcionariosService.CheckNameAvailabilityAsync(name, TenantId, ct));

    [HttpPost("export/csv")]
    [Roles(Roles.Owner, Roles.Admin, Roles.User)]
    public async Task<IActionResult> ExportCsv([FromBody] JsonElement body, CancellationToken ct)
    {
        var ids = new List<string>();
        if (body.TryGetProperty("ids", out var idsEl) && idsEl.ValueKind == JsonValueKind.Array)
            ids = idsEl.EnumerateArray().Select(e => e.GetString()!).Where(s => !string.IsNullOrEmpty(s)).ToList();

        if (ids.Count > IBulkJobService.SyncThreshold)
            return Ok(await bulkJobService.EnqueueExportCsvAsync(ids, TenantId, ct));

        var csv = await funcionariosService.ExportCsvAsync(TenantId, ids, ct);
        Response.Headers.ContentDisposition = "attachment; filename=\"funcionarios.csv\"";
        return Content(csv, "text/csv; charset=utf-8");
    }

    [HttpGet("{id}/has-funcionarios")]
    public async Task<IActionResult> CheckHasFuncionarios(string id, CancellationToken ct)
    {
        var hasEmployees = await funcionariosService.HasFuncionariosAsync(id, ct);
        return Ok(new { hasEmployees });
    }

    [HttpPost("por-divisoes")]
    public async Task<IActionResult> BuscarPorDivisoes([FromBody] JsonElement body, CancellationToken ct)
    {
        var ids = new List<string>();
        if (body.TryGetProperty("ids", out var idsEl))
        {
            if (idsEl.ValueKind == JsonValueKind.Array)
                ids = idsEl.EnumerateArray().Select(e => e.GetString()!).Where(s => !string.IsNullOrEmpty(s)).ToList();
            else if (idsEl.ValueKind == JsonValueKind.String)
                ids = (idsEl.GetString() ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
        }

        var page = body.TryGetProperty("page", out var p) && p.TryGetInt32(out var pi) ? pi : 1;
        var limit = body.TryGetProperty("limit", out var l) && l.TryGetInt32(out var li) ? li : 50;

        var result = await funcionariosService.BuscarFuncionariosPorDivisoesAsync(
            ids, page, limit, TenantId, FiltersFromBody(body), ct);
        return Ok(PaginatedResponse(result));
    }

    [HttpPost("por-setores")]
    public Task<IActionResult> BuscarPorSetores([FromBody] JsonElement body, CancellationToken ct)
        => BuscarPorDivisoes(body, ct);
}

[ApiController]
[Route("api/funcionarios/relatorio-funcionarios")]
[AuthGuard]
public sealed class RelatorioController(RelatorioService relatorioService) : ControllerBase
{
    [HttpPost("dados")]
    public async Task<IActionResult> ObterDados([FromBody] JsonElement body, CancellationToken ct)
    {
        var ids = new List<string>();
        if (body.TryGetProperty("ids", out var idsEl) && idsEl.ValueKind == JsonValueKind.Array)
            ids = idsEl.EnumerateArray().Select(e => e.GetString()!).Where(s => !string.IsNullOrEmpty(s)).ToList();

        var tipo = body.TryGetProperty("tipo", out var t) && t.ValueKind == JsonValueKind.String
            ? t.GetString() ?? "geral"
            : "geral";

        return Ok(await relatorioService.ObterDadosRelatorioAsync(
            ids, tipo, HttpContext.GetTenantId(), ct));
    }
}
