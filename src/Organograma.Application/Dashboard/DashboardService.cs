using System.Globalization;
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
        var tree = treeObj as IEnumerable<object> ?? [];
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
            var node = ToDict(nodeObj);
            var id = Convert.ToString(node.GetValueOrDefault("_id")) ?? "";
            var nome = Convert.ToString(node.GetValueOrDefault("nome")) ?? "";
            var total = 0;
            if (node.TryGetValue("quantidadeFuncionariosSubtree", out var subtree))
                total = Convert.ToInt32(subtree);

            acc.Add(new RankedSetor(id, nome, total));

            if (node.TryGetValue("subsetores", out var children) && children is IEnumerable<object> list)
                FlattenEstruturaRanking(list, acc);
            else if (children is System.Collections.IEnumerable enumerable and not string)
                FlattenEstruturaRanking(enumerable.Cast<object>(), acc);
        }

        return acc;
    }

    private static Dictionary<string, object?> ToDict(object obj)
    {
        if (obj is Dictionary<string, object?> d) return d;
        if (obj is IReadOnlyDictionary<string, object?> rod)
            return rod.ToDictionary(kv => kv.Key, kv => kv.Value);

        // Anonymous / reflection fallback
        var result = new Dictionary<string, object?>();
        foreach (var prop in obj.GetType().GetProperties())
            result[prop.Name] = prop.GetValue(obj);
        return result;
    }

    private static int GetInt(Dictionary<string, object?> d, string key)
        => d.TryGetValue(key, out var v) && v is not null ? Convert.ToInt32(v) : 0;

    private sealed record RankedSetor(string Id, string Nome, int Total);
}
