using System.Text.Json;
using Organograma.Domain;

namespace Organograma.Application.Funcionarios;

public sealed class RedeSocialInput
{
    public string Link { get; set; } = "";
    public string Nome { get; set; } = "";
}

public sealed class FuncionarioInput
{
    public string Nome { get; set; } = "";
    public string Secretaria { get; set; } = "";
    public string Funcao { get; set; } = "";
    public string? Tipo { get; set; }
    public string Natureza { get; set; } = "";
    public bool ReferenciaSpecified { get; set; }
    public string? Referencia { get; set; }
    public bool ReferenciaIdSpecified { get; set; }
    public string? ReferenciaId { get; set; }
    public List<RedeSocialInput>? RedesSociais { get; set; }
    public double SalarioBruto { get; set; }
    public string? Cidade { get; set; }
    public string? Endereco { get; set; }
    public string? Bairro { get; set; }
    public string? Telefone { get; set; }
    public List<object?>? Observacoes { get; set; }
    public string? SetorId { get; set; }
    public string? Coordenadoria { get; set; }
    public string? InicioContrato { get; set; }
    public string? FimContrato { get; set; }

    public string? ResolveSetorId() =>
        !string.IsNullOrWhiteSpace(SetorId) ? SetorId : Coordenadoria;

    public static FuncionarioInput FromStringMap(IReadOnlyDictionary<string, string?> map)
    {
        string? S(string key) => map.TryGetValue(key, out var v) ? v : null;

        var input = new FuncionarioInput
        {
            Nome = TextNormalizer.Normalize(S("nome") ?? "") ?? "",
            Secretaria = TextNormalizer.Normalize(S("secretaria") ?? "") ?? "",
            Funcao = TextNormalizer.Normalize(S("funcao") ?? "") ?? "",
            Tipo = TextNormalizer.Normalize(S("tipo")),
            Natureza = TextNormalizer.Normalize(S("natureza") ?? "") ?? "",
            ReferenciaSpecified = map.ContainsKey("referencia"),
            Referencia = map.ContainsKey("referencia")
                ? TextNormalizer.Normalize(S("referencia"))
                : null,
            ReferenciaIdSpecified = map.ContainsKey("referenciaId"),
            ReferenciaId = map.ContainsKey("referenciaId") ? S("referenciaId") : null,
            Cidade = TextNormalizer.Normalize(S("cidade")),
            Endereco = TextNormalizer.Normalize(S("endereco")),
            Bairro = TextNormalizer.Normalize(S("bairro")),
            Telefone = S("telefone"),
            SetorId = S("setorId"),
            Coordenadoria = S("coordenadoria"),
            InicioContrato = S("inicioContrato"),
            FimContrato = S("fimContrato"),
        };

        if (double.TryParse(S("salarioBruto"), System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var salario))
            input.SalarioBruto = salario;

        if (map.ContainsKey("redesSociais"))
            input.RedesSociais = ParseRedesSociais(S("redesSociais"));

        if (map.ContainsKey("observacoes"))
            input.Observacoes = ParseMaybeJsonArray(S("observacoes"));

        return input;
    }

    public static List<object?> ParseMaybeJsonArray(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return [];
        var trimmed = value.Trim();
        if (trimmed.StartsWith('['))
        {
            try
            {
                using var doc = JsonDocument.Parse(trimmed);
                if (doc.RootElement.ValueKind != JsonValueKind.Array) return [value];
                return doc.RootElement.EnumerateArray()
                    .Select(JsonElementToObject)
                    .ToList();
            }
            catch
            {
                return [value];
            }
        }
        return [value];
    }

    public static List<RedeSocialInput> ParseRedesSociais(string? value)
    {
        var parsed = ParseMaybeJsonArray(value);
        var result = new List<RedeSocialInput>();
        foreach (var item in parsed)
        {
            if (item is not Dictionary<string, object?> row) continue;
            var rawLink = row.TryGetValue("link", out var l) ? Convert.ToString(l) ?? "" : "";
            var rawNome = row.TryGetValue("nome", out var n) ? (Convert.ToString(n) ?? "").Trim() : "";
            if (string.IsNullOrWhiteSpace(rawLink) || string.IsNullOrWhiteSpace(rawNome)) continue;

            var link = NormalizeLink(rawLink)
                       ?? throw new AppException("redesSociais.link deve ser uma URL válida", 400, "BAD_REQUEST");
            result.Add(new RedeSocialInput
            {
                Link = link,
                Nome = TextNormalizer.Normalize(rawNome) ?? rawNome,
            });
        }
        return result;
    }

    private static string? NormalizeLink(string raw)
    {
        var trimmed = raw.Trim();
        if (trimmed.Length == 0) return null;
        var withProtocol = System.Text.RegularExpressions.Regex.IsMatch(trimmed, @"^https?:\/\/",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase)
            ? trimmed
            : $"https://{trimmed}";
        return Uri.TryCreate(withProtocol, UriKind.Absolute, out _) ? withProtocol : null;
    }

    private static object? JsonElementToObject(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.String => el.GetString(),
        JsonValueKind.Number => el.TryGetInt64(out var i) ? i : el.GetDouble(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        JsonValueKind.Object => el.EnumerateObject()
            .ToDictionary(p => p.Name, p => JsonElementToObject(p.Value)),
        JsonValueKind.Array => el.EnumerateArray().Select(JsonElementToObject).Cast<object?>().ToList(),
        _ => el.GetRawText(),
    };
}
