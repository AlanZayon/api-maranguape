namespace Organograma.Domain;

public static class OrganizarSetores
{
    /// <summary>
    /// Builds a nested tree of setores/subsetores starting at <paramref name="parentId"/>,
    /// annotating each node with direct and subtree employee counts.
    /// </summary>
    public static List<Dictionary<string, object?>> Build(
        IReadOnlyList<Dictionary<string, object?>> setores,
        IReadOnlyDictionary<string, int> funcionariosPorSetor,
        object? parentId = null)
    {
        var target = ParentKey(parentId);
        var result = new List<Dictionary<string, object?>>();

        foreach (var setor in setores)
        {
            if (ParentKey(setor.GetValueOrDefault("parent")) != target) continue;

            var node = new Dictionary<string, object?>(setor);
            var id = Convert.ToString(node.GetValueOrDefault("_id")) ?? "";
            var children = Build(setores, funcionariosPorSetor, node.GetValueOrDefault("_id"));
            var direct = funcionariosPorSetor.TryGetValue(id, out var d) ? d : 0;
            var subtreeFromChildren = children.Sum(c =>
                c.TryGetValue("quantidadeFuncionariosSubtree", out var v) && v is int i ? i : 0);

            node["quantidadeFuncionarios"] = direct;
            node["quantidadeFuncionariosSubtree"] = direct + subtreeFromChildren;
            node["subsetores"] = children;
            result.Add(node);
        }

        return result;
    }

    private static string? ParentKey(object? value)
    {
        if (value is null) return null;
        var s = Convert.ToString(value);
        return string.IsNullOrEmpty(s) ? null : s;
    }
}
