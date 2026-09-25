using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;

namespace Organograma.Application.Funcionarios;

public sealed class RelatorioService(
    IFuncionariosRepository funcionariosRepository,
    ITenantsRepository tenantsRepository,
    IS3Service s3Service)
{
    private static readonly string[] TiposValidos = ["geral", "salarial", "referencias", "localidade"];

    public string ObterTituloRelatorio(string tipo, string? displayName = null)
    {
        var titulos = new Dictionary<string, string>
        {
            ["salarial"] = "Relatório Salarial",
            ["referencias"] = "Relatório de Indicações",
            ["localidade"] = "Relatório de Localização de Servidores",
            ["geral"] = "Relatório Geral de Funcionários",
        };
        var bas = titulos.GetValueOrDefault(tipo, titulos["geral"]);
        var orgao = displayName?.Trim() ?? "";
        return orgao.Length > 0 ? $"{bas} — {orgao}" : bas;
    }

    private async Task<string?> ResolveMediaUrlAsync(string? value, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(value)) return null;
        if (System.Text.RegularExpressions.Regex.IsMatch(value, @"^https?:\/\/", System.Text.RegularExpressions.RegexOptions.IgnoreCase)
            || value.StartsWith("data:", StringComparison.Ordinal))
            return value;
        try
        {
            return await s3Service.GerarUrlPreAssinadaAsync(value, ct) ?? value;
        }
        catch
        {
            return value;
        }
    }

    private async Task<object?> CarregarBrandingTenantAsync(string? tenantId, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(tenantId)) return null;
        try
        {
            var tenant = await tenantsRepository.FindByIdAsync(tenantId, ct);
            if (tenant is null) return null;
            var branding = tenant.Branding ?? new Domain.Entities.Branding();
            return new Dictionary<string, object?>
            {
                ["logoUrl"] = await ResolveMediaUrlAsync(branding.LogoUrl, ct),
                ["faviconUrl"] = await ResolveMediaUrlAsync(branding.FaviconUrl, ct),
                ["displayName"] = branding.DisplayName ?? tenant.Name,
                ["primaryColor"] = branding.PrimaryColor,
                ["secondaryColor"] = branding.SecondaryColor,
                ["primaryContrast"] = branding.PrimaryContrast,
                ["headerBg"] = branding.HeaderBg,
                ["headerText"] = branding.HeaderText,
                ["sidebarBg"] = branding.SidebarBg,
                ["sidebarText"] = branding.SidebarText,
                ["surfaceBg"] = branding.SurfaceBg,
                ["pageBg"] = branding.PageBg,
                ["textColor"] = branding.TextColor,
                ["mutedColor"] = branding.MutedColor,
                ["borderColor"] = branding.BorderColor,
                ["fontFamily"] = branding.FontFamily,
                ["fontUrl"] = branding.FontUrl,
                ["themeMode"] = branding.ThemeMode,
                ["customCss"] = branding.CustomCss,
            };
        }
        catch
        {
            return null;
        }
    }

    private static Dictionary<string, object?> MapFuncionario(Funcionario f) => new()
    {
        ["id"] = f.Id.ToString(),
        ["nome"] = f.Nome ?? "",
        ["secretaria"] = f.Secretaria,
        ["funcao"] = f.Funcao,
        ["natureza"] = f.Natureza,
        ["salarioBruto"] = f.SalarioBruto,
        ["referencia"] = f.Referencia,
        ["bairro"] = f.Bairro,
        ["cidade"] = f.Cidade,
    };

    private static (bool IsValid, List<string> Missing) Validate(Funcionario f)
    {
        var missing = new List<string>();
        if (string.IsNullOrEmpty(f.Nome)) missing.Add("nome");
        if (string.IsNullOrEmpty(f.Secretaria)) missing.Add("secretaria");
        if (string.IsNullOrEmpty(f.Funcao)) missing.Add("funcao");
        if (string.IsNullOrEmpty(f.Natureza)) missing.Add("natureza");
        // salarioBruto 0 is valid
        return (missing.Count == 0, missing);
    }

    private static object CalcularResumo(List<Dictionary<string, object?>> funcionarios)
    {
        var total = funcionarios.Count;
        var totalSalarios = funcionarios.Sum(f => Convert.ToDouble(f.GetValueOrDefault("salarioBruto") ?? 0));
        return new
        {
            totalFuncionarios = total,
            totalSalarios,
            mediaSalarial = total > 0 ? totalSalarios / total : 0d,
        };
    }

    private static List<Dictionary<string, object?>> Enriquecer(
        List<Dictionary<string, object?>> items,
        int totalFuncionarios)
    {
        return items
            .Select(item =>
            {
                var count = Convert.ToInt32(item["count"]);
                var totalSalario = Convert.ToDouble(item["totalSalario"]);
                var row = new Dictionary<string, object?>
                {
                    ["chave"] = item.GetValueOrDefault("_id") ?? "Não informado",
                    ["count"] = count,
                    ["totalSalario"] = totalSalario,
                    ["mediaSalarial"] = count > 0 ? totalSalario / count : 0d,
                    ["percentual"] = totalFuncionarios > 0
                        ? Math.Round(count / (double)totalFuncionarios * 100, 2)
                        : 0d,
                };
                if (item.ContainsKey("cidade"))
                    row["cidade"] = item["cidade"];
                return row;
            })
            .OrderByDescending(r => Convert.ToInt32(r["count"]))
            .ToList();
    }

    private static List<Dictionary<string, object?>> AgruparPorCampo(
        List<Dictionary<string, object?>> funcionarios,
        string campo,
        string? campoAdicional = null)
    {
        var agrupado = new Dictionary<string, Dictionary<string, object?>>();
        foreach (var func in funcionarios)
        {
            var valorCampo = Convert.ToString(func.GetValueOrDefault(campo)) is { Length: > 0 } v ? v : "Não informado";
            var valorAdicional = campoAdicional is not null
                ? (Convert.ToString(func.GetValueOrDefault(campoAdicional)) is { Length: > 0 } a ? a : "Não informado")
                : null;
            var chave = campoAdicional is not null ? $"{valorCampo}||{valorAdicional}" : valorCampo;

            if (!agrupado.TryGetValue(chave, out var bucket))
            {
                bucket = new Dictionary<string, object?>
                {
                    ["_id"] = valorCampo,
                    ["count"] = 0,
                    ["totalSalario"] = 0d,
                };
                if (campoAdicional is not null)
                    bucket[campoAdicional] = valorAdicional;
                agrupado[chave] = bucket;
            }

            bucket["count"] = Convert.ToInt32(bucket["count"]) + 1;
            bucket["totalSalario"] = Convert.ToDouble(bucket["totalSalario"])
                                     + Convert.ToDouble(func.GetValueOrDefault("salarioBruto") ?? 0);
        }
        return agrupado.Values.ToList();
    }

    private static object? BuildAgrupamentos(string tipo, List<Dictionary<string, object?>> funcionarios)
    {
        var total = funcionarios.Count;
        return tipo switch
        {
            "salarial" => new
            {
                porNatureza = Enriquecer(AgruparPorCampo(funcionarios, "natureza"), total),
                porSecretaria = Enriquecer(AgruparPorCampo(funcionarios, "secretaria"), total),
            },
            "referencias" => new
            {
                porReferencia = Enriquecer(AgruparPorCampo(funcionarios, "referencia"), total),
            },
            "localidade" => new
            {
                porCidade = Enriquecer(AgruparPorCampo(funcionarios, "cidade"), total),
                porBairro = Enriquecer(AgruparPorCampo(funcionarios, "bairro", "cidade"), total),
            },
            _ => null,
        };
    }

    public async Task<object> ObterDadosRelatorioAsync(
        IReadOnlyList<string> ids,
        string tipoRelatorio,
        string? tenantId,
        CancellationToken ct = default)
    {
        if (!TiposValidos.Contains(tipoRelatorio))
            throw new AppException(
                $"Tipo de relatório inválido. Opções: {string.Join(", ", TiposValidos)}",
                400,
                "BAD_REQUEST");

        if (ids.Count == 0)
            throw new AppException(
                "Selecione pelo menos um funcionário para gerar o relatório.",
                400,
                "BAD_REQUEST");

        var raw = await funcionariosRepository.FindByIdsAsync(ids, tenantId, ct);
        var funcionarios = raw
            .Select(MapFuncionario)
            .OrderBy(f => Convert.ToString(f["nome"]) ?? "", StringComparer.Create(new System.Globalization.CultureInfo("pt-BR"), false))
            .ToList();

        var avisos = new List<string>();
        var incompletos = raw.Count(f => !Validate(f).IsValid);
        if (incompletos > 0)
            avisos.Add($"{incompletos} funcionário(s) com dados incompletos. O relatório pode estar parcial.");
        if (funcionarios.Count == 0)
            avisos.Add("Nenhum funcionário encontrado para os critérios selecionados.");

        var branding = await CarregarBrandingTenantAsync(tenantId, ct) as Dictionary<string, object?>;
        var displayName = branding?.GetValueOrDefault("displayName") as string;

        return new
        {
            tipo = tipoRelatorio,
            titulo = ObterTituloRelatorio(tipoRelatorio, displayName),
            geradoEm = DateTime.UtcNow.ToString("O"),
            funcionarios,
            resumo = CalcularResumo(funcionarios),
            agrupamentos = BuildAgrupamentos(tipoRelatorio, funcionarios),
            avisos,
            branding,
        };
    }
}
