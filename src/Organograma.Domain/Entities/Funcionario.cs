using Organograma.Domain.Serialization;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Organograma.Domain.Entities;

[BsonIgnoreExtraElements]
public sealed class RedeSocial
{
    [BsonElement("link")]
    public string? Link { get; set; }

    [BsonElement("nome")]
    public string? Nome { get; set; }
}

[BsonIgnoreExtraElements]
public sealed class Observacao
{
    [BsonElement("texto")]
    public string Texto { get; set; } = "";

    [BsonElement("createdAt")]
    [BsonIgnoreIfNull]
    public DateTime? CreatedAt { get; set; }

    [BsonId]
    [BsonIgnoreIfDefault]
    public ObjectId? Id { get; set; }
}

[BsonIgnoreExtraElements]
public sealed class Funcionario
{
    [BsonId]
    public ObjectId Id { get; set; }

    [BsonElement("nome")]
    public string Nome { get; set; } = "";

    [BsonElement("foto")]
    public string? Foto { get; set; }

    [BsonElement("secretaria")]
    public string Secretaria { get; set; } = "";

    [BsonElement("funcao")]
    public string Funcao { get; set; } = "";

    [BsonElement("tipo")]
    [BsonIgnoreIfNull]
    public string? Tipo { get; set; }

    [BsonElement("natureza")]
    public string Natureza { get; set; } = "";

    [BsonElement("referencia")]
    [BsonIgnoreIfNull]
    public string? Referencia { get; set; }

    [BsonElement("referenciaId")]
    [BsonIgnoreIfNull]
    public ObjectId? ReferenciaId { get; set; }

    [BsonElement("redesSociais")]
    public List<RedeSocial> RedesSociais { get; set; } = [];

    [BsonElement("salarioBruto")]
    public double SalarioBruto { get; set; }

    [BsonElement("endereco")]
    [BsonIgnoreIfNull]
    public string? Endereco { get; set; }

    [BsonElement("cidade")]
    [BsonIgnoreIfNull]
    public string? Cidade { get; set; }

    [BsonElement("bairro")]
    [BsonIgnoreIfNull]
    public string? Bairro { get; set; }

    [BsonElement("telefone")]
    [BsonIgnoreIfNull]
    public string? Telefone { get; set; }

    [BsonElement("observacoes")]
    public List<BsonValue> Observacoes { get; set; } = [];

    [BsonElement("arquivo")]
    public string? Arquivo { get; set; }

    [BsonElement("setorId")]
    public ObjectId SetorId { get; set; }

    /// <summary>Legacy alias field still present on some docs.</summary>
    [BsonElement("coordenadoria")]
    [BsonIgnoreIfNull]
    public ObjectId? Coordenadoria { get; set; }

    [BsonElement("inicioContrato")]
    public DateTime? InicioContrato { get; set; }

    [BsonElement("fimContrato")]
    [BsonSerializer(typeof(FimContratoSerializer))]
    public FimContrato? FimContrato { get; set; }

    [BsonElement("tenantId")]
    [BsonIgnoreIfNull]
    public ObjectId? TenantId { get; set; }

    [BsonElement("createdBy")]
    [BsonIgnoreIfNull]
    public ObjectId? CreatedBy { get; set; }

    [BsonElement("updatedBy")]
    [BsonIgnoreIfNull]
    public ObjectId? UpdatedBy { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
