namespace Organograma.Application.Funcionarios;

public sealed class ListFilters
{
    public string Q { get; set; } = "";
    public string Natureza { get; set; } = "";
    public string Secretaria { get; set; } = "";
    public string Funcao { get; set; } = "";
    public string Bairro { get; set; } = "";
    public string Referencia { get; set; } = "";

    public bool HasActiveFilters()
        => !string.IsNullOrWhiteSpace(Q)
           || !string.IsNullOrWhiteSpace(Natureza)
           || !string.IsNullOrWhiteSpace(Secretaria)
           || !string.IsNullOrWhiteSpace(Funcao)
           || !string.IsNullOrWhiteSpace(Bairro)
           || !string.IsNullOrWhiteSpace(Referencia);

    public static ListFilters FromDict(IDictionary<string, string?>? values)
    {
        values ??= new Dictionary<string, string?>();
        string Get(string key) =>
            values.TryGetValue(key, out var v) && v is not null ? v : "";

        return new ListFilters
        {
            Q = Get("q"),
            Natureza = Get("natureza"),
            Secretaria = Get("secretaria"),
            Funcao = Get("funcao"),
            Bairro = Get("bairro"),
            Referencia = Get("referencia"),
        };
    }
}

public sealed class PaginatedFuncionarios
{
    public List<Dictionary<string, object?>> Funcionarios { get; set; } = [];
    public long Total { get; set; }
    public int Page { get; set; }
    public int Pages { get; set; }
    public object? Filtros { get; set; }
}
