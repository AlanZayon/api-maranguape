using ClosedXML.Excel;
using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using MongoDB.Bson;

namespace Organograma.Application.CargosComissionados;

public sealed class CreateCargoComissionadoDto
{
    public string Tipo { get; set; } = "";
    public string Cargo { get; set; } = "";
    public string Simbologia { get; set; } = "";
    public double ADefinir { get; set; }
    public int? Limite { get; set; }
}

public sealed class CargoAuditContext
{
    public string? TenantId { get; set; }
    public string? UserId { get; set; }
}

public sealed class CargosComissionadosService(
    ICargosComissionadosRepository cargosRepository,
    ICacheService cacheService)
{
    private Task InvalidateCacheAsync(string? tenantId, CancellationToken ct)
        => cacheService.BumpVersionAsync(tenantId, ct);

    public Task<IReadOnlyList<object>> ListarCargosAsync(
        string? tenantId = null,
        CancellationToken ct = default)
        => cacheService.GetOrSetCacheAsync(
            TenantHelpers.CacheKey(tenantId, "todos:cargosComissionados"),
            async () =>
            {
                var docs = await cargosRepository.BuscarTodosAsync(tenantId, ct);
                return (IReadOnlyList<object>)docs.Select(BsonToObject).ToList();
            },
            ct: ct);

    public async Task<LimiteSimbologia> GarantirSimbologiaAsync(
        string simbologia,
        int? limite,
        string? tenantId,
        string? userId,
        CancellationToken ct = default)
    {
        var existing = await cargosRepository.BuscarPorSimbologiaAsync(simbologia, tenantId, ct);
        if (existing is null && limite is null)
        {
            throw new AppException(
                $"Simbologia \"{simbologia}\" não existe. Informe o limite para criá-la.",
                400,
                "SIMBOLOGIA_REQUIRED");
        }

        var result = await cargosRepository.UpsertSimbologiaAsync(
            simbologia, limite, tenantId, userId, ct);

        if (result is null)
        {
            throw new AppException(
                $"Não foi possível criar a simbologia \"{simbologia}\".",
                400,
                "SIMBOLOGIA_CREATE_FAILED");
        }

        return result;
    }

    public async Task<object> CriarAsync(
        CreateCargoComissionadoDto payload,
        CargoAuditContext ctx,
        CancellationToken ct = default)
    {
        var tenantId = ctx.TenantId;
        var userId = ctx.UserId;
        var tipo = TextNormalizer.NormalizarTexto(payload.Tipo);
        var cargo = TextNormalizer.NormalizarTexto(payload.Cargo);
        var simbologia = TextNormalizer.NormalizarTexto(payload.Simbologia);
        var aDefinir = payload.ADefinir;
        var limite = payload.Limite;

        var existente = await cargosRepository.BuscarPorNomeAsync(cargo, tenantId, ct);
        if (existente is not null)
        {
            throw new AppException(
                $"Já existe um cargo comissionado com o nome \"{cargo}\".",
                400,
                "CARGO_DUPLICATE");
        }

        await GarantirSimbologiaAsync(simbologia, limite, tenantId, userId, ct);

        var userOid = TenantHelpers.ToObjectId(userId);
        var created = await cargosRepository.CriarAsync(new CargoComissionado
        {
            Id = ObjectId.GenerateNewId(),
            Tipo = tipo,
            Cargo = cargo,
            Simbologia = simbologia,
            ADefinir = aDefinir,
            TenantId = TenantHelpers.ToObjectId(tenantId),
            CreatedBy = userOid,
            UpdatedBy = userOid,
        }, ct);

        await InvalidateCacheAsync(tenantId, ct);
        return ToApi(created);
    }

    public async Task<object> AtualizarAsync(
        string id,
        CreateCargoComissionadoDto payload,
        CargoAuditContext ctx,
        CancellationToken ct = default)
    {
        var tenantId = ctx.TenantId;
        var userId = ctx.UserId;
        var atual = await cargosRepository.BuscarPorIdAsync(id, tenantId, ct)
            ?? throw new AppException("Cargo comissionado não encontrado.", 404, "NOT_FOUND");

        var tipo = TextNormalizer.NormalizarTexto(payload.Tipo);
        var cargo = TextNormalizer.NormalizarTexto(payload.Cargo);
        var simbologia = TextNormalizer.NormalizarTexto(payload.Simbologia);
        var aDefinir = payload.ADefinir;
        var limite = payload.Limite;

        if (cargo != atual.Cargo)
        {
            var conflito = await cargosRepository.BuscarPorNomeAsync(cargo, tenantId, ct);
            if (conflito is not null && conflito.Id.ToString() != id)
            {
                throw new AppException(
                    $"Já existe um cargo comissionado com o nome \"{cargo}\".",
                    400,
                    "CARGO_DUPLICATE");
            }
        }

        await GarantirSimbologiaAsync(simbologia, limite, tenantId, userId, ct);

        var updated = await cargosRepository.AtualizarAsync(
            id,
            new CargoComissionado
            {
                Tipo = tipo,
                Cargo = cargo,
                Simbologia = simbologia,
                ADefinir = aDefinir,
                UpdatedBy = TenantHelpers.ToObjectId(userId),
            },
            tenantId,
            ct);

        await InvalidateCacheAsync(tenantId, ct);
        return ToApi(updated ?? atual);
    }

    public async Task<object> RemoverAsync(string id, CargoAuditContext ctx, CancellationToken ct = default)
    {
        var tenantId = ctx.TenantId;
        var atual = await cargosRepository.BuscarPorIdAsync(id, tenantId, ct);
        if (atual is null)
            throw new AppException("Cargo comissionado não encontrado.", 404, "NOT_FOUND");

        await cargosRepository.RemoverAsync(id, tenantId, ct);
        await InvalidateCacheAsync(tenantId, ct);
        return new { message = "Cargo comissionado removido com sucesso." };
    }

    public byte[] GerarTemplateBuffer()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Cargos");
        sheet.Cell(1, 1).Value = "tipo";
        sheet.Cell(1, 2).Value = "cargo";
        sheet.Cell(1, 3).Value = "simbologia";
        sheet.Cell(1, 4).Value = "aDefinir";
        sheet.Cell(1, 5).Value = "limite";
        sheet.Cell(2, 1).Value = "DAS";
        sheet.Cell(2, 2).Value = "ASSESSOR ESPECIAL";
        sheet.Cell(2, 3).Value = "DAS-1";
        sheet.Cell(2, 4).Value = 5000;
        sheet.Cell(2, 5).Value = 10;
        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }

    public async Task<object> ImportarPlanilhaAsync(
        Stream fileStream,
        CargoAuditContext ctx,
        CancellationToken ct = default)
    {
        if (fileStream is null || !fileStream.CanRead)
            throw new AppException("Arquivo inválido ou vazio.", 400, "INVALID_FILE");

        byte[] buffer;
        using (var ms = new MemoryStream())
        {
            await fileStream.CopyToAsync(ms, ct);
            buffer = ms.ToArray();
        }

        if (buffer.Length == 0)
            throw new AppException("Arquivo inválido ou vazio.", 400, "INVALID_FILE");

        XLWorkbook workbook;
        try
        {
            workbook = new XLWorkbook(new MemoryStream(buffer));
        }
        catch
        {
            throw new AppException(
                "Não foi possível ler o arquivo. Envie um .xlsx válido.",
                400,
                "INVALID_XLSX");
        }

        using (workbook)
        {
            var sheet = workbook.Worksheets.FirstOrDefault()
                ?? throw new AppException("Planilha sem abas.", 400, "EMPTY_SHEET");

            var headerRow = sheet.FirstRowUsed()
                ?? throw new AppException("Planilha sem dados.", 400, "EMPTY_DATA");

            var headers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var cell in headerRow.CellsUsed())
            {
                var name = cell.GetString().Trim();
                if (!string.IsNullOrEmpty(name))
                    headers[name] = cell.Address.ColumnNumber;
            }

            int Col(params string[] names)
            {
                foreach (var n in names)
                    if (headers.TryGetValue(n, out var c)) return c;
                return -1;
            }

            var tipoCol = Col("tipo", "Tipo");
            var cargoCol = Col("cargo", "Cargo");
            var simbCol = Col("simbologia", "Simbologia");
            var aDefinirCol = Col("aDefinir", "ADefinir", "a definir");
            var limiteCol = Col("limite", "Limite");

            var dataRows = sheet.RowsUsed().Skip(1).ToList();
            if (dataRows.Count == 0)
                throw new AppException("Planilha sem dados.", 400, "EMPTY_DATA");

            var tenantId = ctx.TenantId;
            var userId = ctx.UserId;
            var created = new List<object>();
            var updated = new List<object>();
            var errors = new List<object>();

            for (var i = 0; i < dataRows.Count; i++)
            {
                var rowNumber = i + 2;
                var row = dataRows[i];
                try
                {
                    string Cell(int col) => col > 0 ? row.Cell(col).GetFormattedString().Trim() : "";

                    var tipo = TextNormalizer.NormalizarTexto(Cell(tipoCol));
                    var cargo = TextNormalizer.NormalizarTexto(Cell(cargoCol));
                    var simbologia = TextNormalizer.NormalizarTexto(Cell(simbCol));
                    var aDefinirRaw = Cell(aDefinirCol);
                    var limiteRaw = Cell(limiteCol);

                    if (string.IsNullOrEmpty(tipo) || string.IsNullOrEmpty(cargo)
                        || string.IsNullOrEmpty(simbologia) || string.IsNullOrEmpty(aDefinirRaw))
                    {
                        throw new InvalidOperationException(
                            "Colunas obrigatórias: tipo, cargo, simbologia, aDefinir.");
                    }

                    var aDefinir = ParseNumber(aDefinirRaw);
                    if (double.IsNaN(aDefinir))
                        throw new InvalidOperationException("aDefinir deve ser numérico.");

                    int? limite = null;
                    if (!string.IsNullOrEmpty(limiteRaw))
                    {
                        var lim = ParseNumber(limiteRaw);
                        if (double.IsNaN(lim) || lim < 0)
                            throw new InvalidOperationException("limite deve ser um número >= 0.");
                        limite = (int)lim;
                    }

                    await GarantirSimbologiaAsync(simbologia, limite, tenantId, userId, ct);

                    var existente = await cargosRepository.BuscarPorNomeAsync(cargo, tenantId, ct);
                    if (existente is not null)
                    {
                        await cargosRepository.AtualizarAsync(
                            existente.Id.ToString(),
                            new CargoComissionado
                            {
                                Tipo = tipo,
                                Cargo = cargo,
                                Simbologia = simbologia,
                                ADefinir = aDefinir,
                                UpdatedBy = TenantHelpers.ToObjectId(userId),
                            },
                            tenantId,
                            ct);
                        updated.Add(new { row = rowNumber, cargo });
                    }
                    else
                    {
                        var userOid = TenantHelpers.ToObjectId(userId);
                        await cargosRepository.CriarAsync(new CargoComissionado
                        {
                            Id = ObjectId.GenerateNewId(),
                            Tipo = tipo,
                            Cargo = cargo,
                            Simbologia = simbologia,
                            ADefinir = aDefinir,
                            TenantId = TenantHelpers.ToObjectId(tenantId),
                            CreatedBy = userOid,
                            UpdatedBy = userOid,
                        }, ct);
                        created.Add(new { row = rowNumber, cargo });
                    }
                }
                catch (Exception ex)
                {
                    errors.Add(new { row = rowNumber, message = ex.Message });
                }
            }

            await InvalidateCacheAsync(tenantId, ct);

            return new
            {
                created = created.Count,
                updated = updated.Count,
                errors,
                details = new { created, updated },
            };
        }
    }

    private static double ParseNumber(string raw)
    {
        var cleaned = raw.Replace(".", "").Replace(",", ".");
        return double.TryParse(cleaned, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var n)
            ? n
            : double.NaN;
    }

    private static object ToApi(CargoComissionado c) => new
    {
        _id = c.Id.ToString(),
        tipo = c.Tipo,
        cargo = c.Cargo,
        simbologia = c.Simbologia,
        aDefinir = c.ADefinir,
        tenantId = c.TenantId?.ToString(),
        createdBy = c.CreatedBy?.ToString(),
        updatedBy = c.UpdatedBy?.ToString(),
    };

    private static object? BsonToObject(BsonValue value) => value.BsonType switch
    {
        BsonType.Document => ((BsonDocument)value).Elements
            .ToDictionary(e => e.Name, e => BsonToObject(e.Value)),
        BsonType.Array => ((BsonArray)value).Select(BsonToObject).ToList(),
        BsonType.Null => null,
        BsonType.ObjectId => value.AsObjectId.ToString(),
        BsonType.Boolean => value.AsBoolean,
        BsonType.Int32 => value.AsInt32,
        BsonType.Int64 => value.AsInt64,
        BsonType.Double => value.AsDouble,
        BsonType.String => value.AsString,
        BsonType.DateTime => value.ToUniversalTime(),
        BsonType.Decimal128 => value.AsDecimal,
        _ => value.ToString(),
    };
}
