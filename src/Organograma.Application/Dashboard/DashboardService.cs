using System.Collections;
using System.Globalization;
using System.Text.Json;
using Organograma.Application.Abstractions;
using Organograma.Application.Setores;

namespace Organograma.Application.Dashboard;

public sealed class DashboardService(
    IDashboardRepository dashboardRepository,
    SetoresService setoresService)
{
    public async Task<object> GetCotasSimbologiaAsync(string? tenantId = null, CancellationToken ct = default)
    {
        var simbologiasTask = dashboardRepository.ListSimbologiasAsync(tenantId, ct);
        var ocupadasTask = dashboardRepository.CountOcupadasPorSimbologiaAsync(tenantId, ct);
        await Task.WhenAll(simbologiasTask, ocupadasTask);

        var simbologias = await simbologiasTask;
        var ocupadasMap = await ocupadasTask;

        return simbologias.Select(s =>
        {
            var limite = s.Limite;
            var ocupadas = ocupadasMap.GetValueOrDefault(s.Simbologia);
            var disponiveis = Math.Max(0, limite - ocupadas);
            var pct = limite > 0 ? (int)Math.Round((ocupadas / (double)limite) * 100) : 0;
            return new
            {
                simbologia = s.Simbologia,
                limite,
                vagas = limite,
                ocupadas,
                disponiveis,
                pct,
                estourada = ocupadas > limite,
            };
        }).ToList();
    }

    public async Task<object> GetEstruturaSnapshotAsync(string? tenantId = null, CancellationToken ct = default)
    {
        var treeObj = await setoresService.GetSetoresOrganizadosAsync(tenantId, ct);
        var tree = AsObjectEnumerable(UnwrapJson(treeObj));
        var ranked = FlattenEstruturaRanking(tree);

        var totalSetores = ranked.Count;
        var setoresSemLotacao = ranked.Count(s => s.Total == 0);

        ranked.Sort((a, b) => b.Total.CompareTo(a.Total));

        var setoresVazios = ranked
            .Where(s => s.Total == 0)
            .OrderBy(s => s.Nome, StringComparer.Create(new CultureInfo("pt-BR"), false))
            .Take(8)
            .Select(s => new { id = s.Id, nome = s.Nome, total = s.Total })
            .ToList();

        return new
        {
            totalSetores,
            setoresSemLotacao,
            topSetores = ranked
                .Where(s => s.Total > 0)
                .Take(8)
                .Select(s => new { id = s.Id, nome = s.Nome, total = s.Total })
                .ToList(),
            setoresVazios,
        };
    }

    public async Task<object> GetSummaryAsync(string? tenantId = null, CancellationToken ct = default)
    {
        var headcountTask = dashboardRepository.CountByTenantAsync(tenantId, ct);
        var byNaturezaTask = dashboardRepository.GroupByFieldAsync("natureza", tenantId, ct: ct);
        var bySecretariaTask = dashboardRepository.GroupByFieldAsync("secretaria", tenantId, topN: 10, ct: ct);
        var cotasTask = GetCotasSimbologiaAsync(tenantId, ct);
        var contratosTask = dashboardRepository.CountContratosBucketsAsync(tenantId, ct);
        var estruturaTask = GetEstruturaSnapshotAsync(tenantId, ct);

        await Task.WhenAll(headcountTask, byNaturezaTask, bySecretariaTask, cotasTask, contratosTask, estruturaTask);

        var cotasSimbologia = ((IEnumerable<object>)await cotasTask).ToList();
        var cotasOcupadas = 0;
        var cotasLimite = 0;
        var estouradas = 0;

        foreach (var c in cotasSimbologia)
        {
            var d = ToDict(c);
            cotasOcupadas += GetInt(d, "ocupadas");
            cotasLimite += GetInt(d, "limite");
            if (d.TryGetValue("estourada", out var e) && e is true) estouradas++;
        }

        var cotasPct = cotasLimite > 0
            ? (int)Math.Round((cotasOcupadas / (double)cotasLimite) * 100)
            : 0;

        var buckets = await contratosTask;

        return new
        {
            headcount = await headcountTask,
            byNatureza = await byNaturezaTask,
            bySecretaria = await bySecretariaTask,
            cotasSimbologia,
            cotasResumo = new
            {
                ocupadas = cotasOcupadas,
                limite = cotasLimite,
                pct = cotasPct,
                estouradas,
            },
            contratosAVencer = new
            {
                in30 = buckets.In30,
                in31to60 = buckets.In31to60,
                in61to90 = buckets.In61to90,
                expired = buckets.Expired,
                indeterminado = buckets.Indeterminado,
            },
            estrutura = await estruturaTask,
            generatedAt = DateTime.UtcNow.ToString("O"),
        };
    }

    public Task<IReadOnlyList<object>> GetContratosAsync(
        string? tenantId = null,
        int withinDays = 90,
        int limit = 20,
        CancellationToken ct = default)
        => dashboardRepository.FindContratosAVencerAsync(tenantId, withinDays, limit, ct);

    public Task<object> GetPayrollAsync(string? tenantId = null, CancellationToken ct = default)
        => dashboardRepository.AggregatePayrollAsync(tenantId, ct: ct);

    private static List<RankedSetor> FlattenEstruturaRanking(
        IEnumerable<object> nodes,
        List<RankedSetor>? acc = null)
    {
        acc ??= [];
        foreach (var nodeObj in nodes)
        {
            var node = ToDict(UnwrapJson(nodeObj));
            var id = Convert.ToString(node.GetValueOrDefault("_id") ?? node.GetValueOrDefault("id")) ?? "";
            var nome = Convert.ToString(node.GetValueOrDefault("nome") ?? node.GetValueOrDefault("name")) ?? "";
            var total = ToInt32(node.GetValueOrDefault("quantidadeFuncionariosSubtree"));

            acc.Add(new RankedSetor(id, nome, total));

            if (!node.TryGetValue("subsetores", out var children) || children is null)
                node.TryGetValue("children", out children);

            var childNodes = AsObjectEnumerable(UnwrapJson(children));
            if (childNodes.Count > 0)
                FlattenEstruturaRanking(childNodes, acc);
        }

        return acc;
    }

    private static Dictionary<string, object?> ToDict(object? obj)
    {
        obj = UnwrapJson(obj);
        if (obj is null) return new Dictionary<string, object?>();
        if (obj is Dictionary<string, object?> d) return d;
        if (obj is IReadOnlyDictionary<string, object?> rod)
            return rod.ToDictionary(kv => kv.Key, kv => UnwrapJson(kv.Value));
        if (obj is IDictionary dict)
        {
            var result = new Dictionary<string, object?>();
            foreach (DictionaryEntry entry in dict)
            {
                var key = Convert.ToString(entry.Key);
                if (!string.IsNullOrEmpty(key))
                    result[key] = UnwrapJson(entry.Value);
            }
            return result;
        }

        // Anonymous / reflection fallback
        var reflected = new Dictionary<string, object?>();
        foreach (var prop in obj.GetType().GetProperties())
            reflected[prop.Name] = UnwrapJson(prop.GetValue(obj));
        return reflected;
    }

    private static int GetInt(Dictionary<string, object?> d, string key)
        => d.TryGetValue(key, out var v) ? ToInt32(v) : 0;

    private static int ToInt32(object? value)
    {
        value = UnwrapJson(value);
        if (value is null) return 0;
        if (value is int i) return i;
        if (value is long l) return checked((int)l);
        if (value is double db) return (int)Math.Round(db);
        if (value is float f) return (int)Math.Round(f);
        if (value is decimal m) return (int)Math.Round(m);
        if (value is JsonElement je) return JsonElementToInt(je);
        try
        {
            return Convert.ToInt32(value, CultureInfo.InvariantCulture);
        }
        catch
        {
            return int.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture),
                NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed)
                ? parsed
                : 0;
        }
    }

    private static int JsonElementToInt(JsonElement je) => je.ValueKind switch
    {
        JsonValueKind.Number when je.TryGetInt32(out var i) => i,
        JsonValueKind.Number when je.TryGetInt64(out var l) => checked((int)l),
        JsonValueKind.Number => (int)Math.Round(je.GetDouble()),
        JsonValueKind.String when int.TryParse(je.GetString(), NumberStyles.Any,
            CultureInfo.InvariantCulture, out var parsed) => parsed,
        _ => 0,
    };

    /// <summary>
    /// Redis cache deserializes <c>object</c> payloads as <see cref="JsonElement"/>.
    /// Normalize to CLR dictionaries/lists/primitives before dashboard aggregation.
    /// </summary>
    private static object? UnwrapJson(object? value)
    {
        if (value is not JsonElement je) return value;
        return je.ValueKind switch
        {
            JsonValueKind.Object => je.EnumerateObject()
                .ToDictionary(p => p.Name, p => UnwrapJson((object)p.Value), StringComparer.Ordinal),
            JsonValueKind.Array => je.EnumerateArray()
                .Select(e => UnwrapJson((object)e))
                .Where(x => x is not null)
                .Cast<object>()
                .ToList(),
            JsonValueKind.String => je.GetString(),
            JsonValueKind.Number when je.TryGetInt32(out var i) => i,
            JsonValueKind.Number when je.TryGetInt64(out var l) => l,
            JsonValueKind.Number => je.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null or JsonValueKind.Undefined => null,
            _ => je.ToString(),
        };
    }

    private static List<object> AsObjectEnumerable(object? value)
    {
        value = UnwrapJson(value);
        if (value is null) return [];
        if (value is List<object> list) return list;
        if (value is IEnumerable<object> typed) return typed.ToList();
        if (value is IEnumerable enumerable and not string)
            return enumerable.Cast<object?>().Where(x => x is not null).Cast<object>().ToList();
        return [];
    }

    private sealed record RankedSetor(string Id, string Nome, int Total);
}
