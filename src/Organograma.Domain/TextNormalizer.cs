using System.Globalization;
using System.Text;

namespace Organograma.Domain;

/// <summary>Port of Nest <c>normalizarTexto</c> — strip accents, ç→c, upper-case.</summary>
public static class TextNormalizer
{
    public static string? Normalize(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return valor;
        var normalized = valor.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;
            sb.Append(c is 'ç' or 'Ç' ? 'C' : c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).ToUpperInvariant();
    }

    /// <summary>Alias matching Nest method name; never returns null for non-null input.</summary>
    public static string NormalizarTexto(string? valor) => Normalize(valor) ?? "";
}
