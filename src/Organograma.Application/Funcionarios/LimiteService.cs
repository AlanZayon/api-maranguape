using Organograma.Application.Abstractions;
using Organograma.Domain;

namespace Organograma.Application.Funcionarios;

/// <summary>
/// Adjusts commissioned-position (cargo comissionado) <c>limite</c> counters when
/// an employee's função/natureza changes. Ported from Nest LimiteService.
/// </summary>
public sealed class LimiteService(ICargosComissionadosRepository cargoLookup)
{
    public async Task AtualizarLimitesDeFuncaoAsync(
        string antigaFuncaoNome,
        string novaFuncaoNome,
        string? antigaNatureza,
        string? novaNatureza,
        string? tenantId = null,
        CancellationToken ct = default)
    {
        var antigaFuncao = await cargoLookup.BuscarPorNomeAsync(antigaFuncaoNome, tenantId, ct);
        var novaFuncao = await cargoLookup.BuscarPorNomeAsync(novaFuncaoNome, tenantId, ct);

        if (antigaNatureza == "COMISSIONADO" && !string.IsNullOrEmpty(antigaFuncao?.Simbologia))
        {
            var simbologia = await cargoLookup.BuscarPorSimbologiaAsync(
                antigaFuncao.Simbologia, tenantId, ct);
            var novoLimite = (simbologia?.Limite ?? 0) + 1;
            await cargoLookup.UpdateLimiteAsync(antigaFuncao.Simbologia, novoLimite, tenantId, ct);
        }

        if (novaNatureza == "COMISSIONADO" && !string.IsNullOrEmpty(novaFuncao?.Simbologia))
        {
            var simbologia = await cargoLookup.BuscarPorSimbologiaAsync(
                novaFuncao.Simbologia, tenantId, ct);
            var novoLimite = (simbologia?.Limite ?? 0) - 1;
            await cargoLookup.UpdateLimiteAsync(novaFuncao.Simbologia, novoLimite, tenantId, ct);
        }
    }
}
