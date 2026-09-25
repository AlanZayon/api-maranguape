using Organograma.Domain.Entities;
using MongoDB.Bson;

namespace Organograma.Application.Setores;

public static class SetorMapper
{
    public static Dictionary<string, object?> ToDict(Setor s) => new()
    {
        ["_id"] = s.Id.ToString(),
        ["nome"] = s.Nome,
        ["tipo"] = s.Tipo,
        ["parent"] = s.Parent?.ToString(),
        ["tenantId"] = s.TenantId?.ToString(),
        ["createdBy"] = s.CreatedBy?.ToString(),
        ["updatedBy"] = s.UpdatedBy?.ToString(),
        ["createdAt"] = s.CreatedAt,
    };

    public static object ToApi(Setor s) => ToDict(s);
}
