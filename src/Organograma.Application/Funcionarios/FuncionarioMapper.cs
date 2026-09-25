using Organograma.Domain.Entities;
using Organograma.Domain.Serialization;
using MongoDB.Bson;

namespace Organograma.Application.Funcionarios;

public static class FuncionarioMapper
{
    public static Dictionary<string, object?> ToDict(
        Funcionario f,
        string? fotoUrl = null,
        string? arquivoUrl = null)
    {
        var d = new Dictionary<string, object?>
        {
            ["_id"] = f.Id.ToString(),
            ["nome"] = f.Nome,
            ["foto"] = f.Foto,
            ["secretaria"] = f.Secretaria,
            ["funcao"] = f.Funcao,
            ["tipo"] = f.Tipo,
            ["natureza"] = f.Natureza,
            ["referencia"] = f.Referencia,
            ["referenciaId"] = f.ReferenciaId?.ToString(),
            ["redesSociais"] = f.RedesSociais.Select(r => new Dictionary<string, object?>
            {
                ["link"] = r.Link,
                ["nome"] = r.Nome,
            }).ToList(),
            ["salarioBruto"] = f.SalarioBruto,
            ["endereco"] = f.Endereco,
            ["cidade"] = f.Cidade,
            ["bairro"] = f.Bairro,
            ["telefone"] = f.Telefone,
            ["observacoes"] = f.Observacoes.Select(BsonToObject).ToList(),
            ["arquivo"] = f.Arquivo,
            ["setorId"] = f.SetorId.ToString(),
            ["inicioContrato"] = f.InicioContrato,
            ["fimContrato"] = f.FimContrato?.ToApiValue(),
            ["tenantId"] = f.TenantId?.ToString(),
            ["createdBy"] = f.CreatedBy?.ToString(),
            ["updatedBy"] = f.UpdatedBy?.ToString(),
            ["createdAt"] = f.CreatedAt,
        };

        if (fotoUrl is not null) d["fotoUrl"] = fotoUrl;
        if (arquivoUrl is not null) d["arquivoUrl"] = arquivoUrl;
        return d;
    }

    public static Dictionary<string, object?> ToSelecaoDict(Funcionario f) => new()
    {
        ["_id"] = f.Id.ToString(),
        ["nome"] = f.Nome,
        ["funcao"] = f.Funcao,
        ["secretaria"] = f.Secretaria,
        ["natureza"] = f.Natureza,
        ["telefone"] = f.Telefone,
        ["tipo"] = f.Tipo,
        ["referencia"] = f.Referencia,
        ["bairro"] = f.Bairro,
        ["cidade"] = f.Cidade,
    };

    private static object? BsonToObject(BsonValue v)
    {
        if (v.IsBsonNull) return null;
        if (v.IsString) return v.AsString;
        if (v.IsBoolean) return v.AsBoolean;
        if (v.IsInt32) return v.AsInt32;
        if (v.IsInt64) return v.AsInt64;
        if (v.IsDouble) return v.AsDouble;
        if (v.IsValidDateTime) return v.ToUniversalTime();
        if (v.IsObjectId) return v.AsObjectId.ToString();
        if (v.IsBsonDocument)
        {
            var doc = v.AsBsonDocument;
            return doc.Elements.ToDictionary(e => e.Name, e => BsonToObject(e.Value));
        }
        if (v.IsBsonArray)
            return v.AsBsonArray.Select(BsonToObject).ToList();
        return v.ToString();
    }
}
