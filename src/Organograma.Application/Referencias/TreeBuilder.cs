using System.Text.Json;
using System.Text.Json.Serialization;
using Organograma.Application.Abstractions;

namespace Organograma.Application.Referencias;

public sealed class RegisterReferenceDto
{
    public string? FuncionarioId { get; set; }
    public string? Name { get; set; }
    public string? Cargo { get; set; }
    public string? Telefone { get; set; }
    public string? ParentId { get; set; }
}

public sealed class UpdateReferenceDto
{
    public string? Name { get; set; }
    public string? Cargo { get; set; }
    public string? Telefone { get; set; }

    /// <summary>
    /// Distinguishes missing vs null/empty (null/empty → root), matching Nest
    /// <c>parentId !== undefined</c>.
    /// </summary>
    [JsonPropertyName("parentId")]
    public JsonElement ParentIdElement { get; set; }

    [JsonIgnore]
    public bool ParentIdSpecified =>
        ParentIdElement.ValueKind is not JsonValueKind.Undefined;

    [JsonIgnore]
    public string? ParentId => ParentIdElement.ValueKind switch
    {
        JsonValueKind.Null => null,
        JsonValueKind.String => ParentIdElement.GetString(),
        _ => null,
    };
}

public sealed class TreeNode
{
    public string Id { get; set; } = "";
    public string Tipo { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Cargo { get; set; }
    public string? Telefone { get; set; }
    public string? Origem { get; set; }
    public string? FuncionarioId { get; set; }
    public string? ParentId { get; set; }
    public List<TreeNode> Children { get; set; } = [];
}

/// <summary>
/// Builds the forest of references in one pass. Employees are always leaves.
/// Nodes whose parent is missing become roots. Cycles are rescued so they still
/// appear in the visualization.
/// </summary>
public static class TreeBuilder
{
    public static TreeNode ReferenceToNode(ReferenceNode reference) => new()
    {
        Id = reference.Id.ToString(),
        Tipo = "referencia",
        Name = reference.Name,
        Cargo = reference.Cargo,
        Telefone = reference.Telefone,
        Origem = reference.Origem,
        FuncionarioId = reference.FuncionarioId?.ToString(),
        ParentId = reference.ParentId?.ToString(),
        Children = [],
    };

    public static TreeNode FuncionarioToNode(FuncionarioTreeNode funcionario) => new()
    {
        Id = funcionario.Id.ToString(),
        Tipo = "funcionario",
        Name = funcionario.Nome,
        Cargo = funcionario.Funcao,
        Telefone = null,
        Origem = funcionario.Natureza,
        FuncionarioId = funcionario.Id.ToString(),
        ParentId = funcionario.ReferenciaId?.ToString(),
        Children = [],
    };

    public static IReadOnlyList<TreeNode> BuildTree(
        IReadOnlyList<ReferenceNode> referencias,
        IReadOnlyList<FuncionarioTreeNode>? funcionarios = null,
        string? rootId = null)
    {
        var nodes = new Dictionary<string, TreeNode>();
        foreach (var reference in referencias)
        {
            var node = ReferenceToNode(reference);
            nodes[node.Id] = node;
        }

        var roots = new List<TreeNode>();
        foreach (var node in nodes.Values)
        {
            TreeNode? parent = null;
            if (node.ParentId is not null)
                nodes.TryGetValue(node.ParentId, out parent);

            if (parent is not null && !ReferenceEquals(parent, node))
                parent.Children.Add(node);
            else
                roots.Add(node);
        }

        foreach (var funcionario in funcionarios ?? [])
        {
            var node = FuncionarioToNode(funcionario);
            if (node.ParentId is not null && nodes.TryGetValue(node.ParentId, out var parent))
                parent.Children.Add(node);
        }

        // A cycle (A → B → A) would leave nodes out of roots; rescue them.
        var reachable = new HashSet<string>();
        void MarkReachable(TreeNode node)
        {
            if (!reachable.Add(node.Id)) return;
            foreach (var child in node.Children)
                MarkReachable(child);
        }

        foreach (var root in roots)
            MarkReachable(root);

        foreach (var node in nodes.Values)
        {
            if (reachable.Contains(node.Id)) continue;

            if (node.ParentId is not null && nodes.TryGetValue(node.ParentId, out var parent))
                parent.Children.RemoveAll(child => ReferenceEquals(child, node));

            roots.Add(node);
            MarkReachable(node);
        }

        IReadOnlyList<TreeNode> result;
        if (rootId is not null)
        {
            result = nodes.TryGetValue(rootId, out var rootNode)
                ? [rootNode]
                : [];
        }
        else
        {
            result = roots;
        }

        foreach (var node in result)
            SortChildren(node);

        return result
            .OrderBy(a => a.Name, StringComparer.Create(new System.Globalization.CultureInfo("pt-BR"), false))
            .ToList();
    }

    private static void SortChildren(TreeNode node)
    {
        var comparer = StringComparer.Create(new System.Globalization.CultureInfo("pt-BR"), false);
        node.Children.Sort((a, b) =>
        {
            if (a.Tipo != b.Tipo)
                return a.Tipo == "referencia" ? -1 : 1;
            return comparer.Compare(a.Name, b.Name);
        });
        foreach (var child in node.Children)
            SortChildren(child);
    }
}
