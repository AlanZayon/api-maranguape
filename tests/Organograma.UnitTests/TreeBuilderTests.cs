using Organograma.Application.Abstractions;
using Organograma.Application.Referencias;
using MongoDB.Bson;

namespace Organograma.UnitTests;

public class TreeBuilderTests
{
    [Fact]
    public void BuildTree_builds_parent_child_forest()
    {
        var rootId = ObjectId.GenerateNewId();
        var childId = ObjectId.GenerateNewId();
        var refs = new List<ReferenceNode>
        {
            new() { Id = rootId, Name = "Root", ParentId = null },
            new() { Id = childId, Name = "Child", ParentId = rootId },
        };

        var tree = TreeBuilder.BuildTree(refs);

        Assert.Single(tree);
        Assert.Equal("Root", tree[0].Name);
        Assert.Single(tree[0].Children);
        Assert.Equal("Child", tree[0].Children[0].Name);
    }

    [Fact]
    public void BuildTree_orphans_become_roots()
    {
        var missingParent = ObjectId.GenerateNewId();
        var refs = new List<ReferenceNode>
        {
            new() { Id = ObjectId.GenerateNewId(), Name = "Orphan", ParentId = missingParent },
        };

        var tree = TreeBuilder.BuildTree(refs);

        Assert.Single(tree);
        Assert.Equal("Orphan", tree[0].Name);
    }

    [Fact]
    public void BuildTree_attaches_funcionarios_as_leaves()
    {
        var refId = ObjectId.GenerateNewId();
        var funcId = ObjectId.GenerateNewId();
        var refs = new List<ReferenceNode>
        {
            new() { Id = refId, Name = "Indicado", ParentId = null },
        };
        var funcs = new List<FuncionarioTreeNode>
        {
            new()
            {
                Id = funcId,
                Nome = "João",
                Funcao = "Analista",
                Natureza = "EFETIVO",
                ReferenciaId = refId,
            },
        };

        var tree = TreeBuilder.BuildTree(refs, funcs);

        Assert.Single(tree);
        Assert.Single(tree[0].Children);
        Assert.Equal("funcionario", tree[0].Children[0].Tipo);
        Assert.Equal("João", tree[0].Children[0].Name);
    }

    [Fact]
    public void BuildTree_rescues_cycles_as_roots()
    {
        var a = ObjectId.GenerateNewId();
        var b = ObjectId.GenerateNewId();
        var refs = new List<ReferenceNode>
        {
            new() { Id = a, Name = "A", ParentId = b },
            new() { Id = b, Name = "B", ParentId = a },
        };

        var tree = TreeBuilder.BuildTree(refs);

        Assert.Single(tree);
        var names = FlattenNames(tree[0]).ToHashSet();
        Assert.Contains("A", names);
        Assert.Contains("B", names);
    }

    private static IEnumerable<string> FlattenNames(TreeNode node)
    {
        yield return node.Name;
        foreach (var child in node.Children)
        foreach (var name in FlattenNames(child))
            yield return name;
    }

    [Fact]
    public void BuildTree_filters_by_rootId()
    {
        var rootId = ObjectId.GenerateNewId();
        var otherId = ObjectId.GenerateNewId();
        var refs = new List<ReferenceNode>
        {
            new() { Id = rootId, Name = "Keep", ParentId = null },
            new() { Id = otherId, Name = "Drop", ParentId = null },
        };

        var tree = TreeBuilder.BuildTree(refs, rootId: rootId.ToString());

        Assert.Single(tree);
        Assert.Equal("Keep", tree[0].Name);
    }

    [Fact]
    public void BuildTree_sorts_referencias_before_funcionarios()
    {
        var refId = ObjectId.GenerateNewId();
        var refs = new List<ReferenceNode>
        {
            new() { Id = refId, Name = "Parent", ParentId = null },
            new() { Id = ObjectId.GenerateNewId(), Name = "Zeta", ParentId = refId },
        };
        var funcs = new List<FuncionarioTreeNode>
        {
            new()
            {
                Id = ObjectId.GenerateNewId(),
                Nome = "Alpha",
                ReferenciaId = refId,
            },
        };

        var children = TreeBuilder.BuildTree(refs, funcs)[0].Children;
        Assert.Equal("referencia", children[0].Tipo);
        Assert.Equal("funcionario", children[1].Tipo);
    }

    [Fact]
    public void ReferenceToNode_and_FuncionarioToNode_map_fields()
    {
        var refId = ObjectId.GenerateNewId();
        var funcId = ObjectId.GenerateNewId();
        var parentId = ObjectId.GenerateNewId();

        var refNode = TreeBuilder.ReferenceToNode(new ReferenceNode
        {
            Id = refId,
            Name = "Ref",
            Cargo = "Cargo",
            Telefone = "85",
            Origem = "manual",
            FuncionarioId = funcId,
            ParentId = parentId,
        });
        Assert.Equal("referencia", refNode.Tipo);
        Assert.Equal(refId.ToString(), refNode.Id);
        Assert.Equal(funcId.ToString(), refNode.FuncionarioId);

        var funcNode = TreeBuilder.FuncionarioToNode(new FuncionarioTreeNode
        {
            Id = funcId,
            Nome = "Maria",
            Funcao = "Diretora",
            Natureza = "COMISSIONADO",
            ReferenciaId = refId,
        });
        Assert.Equal("funcionario", funcNode.Tipo);
        Assert.Equal("Maria", funcNode.Name);
        Assert.Equal(refId.ToString(), funcNode.ParentId);
    }
}
