using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Organograma.Domain.Entities;

/// <summary>
/// Nest <c>Reference</c> / collection <c>references</c>.
/// Also used by Funcionarios for vínculo resolution by id/name.
/// </summary>
[BsonIgnoreExtraElements]
public sealed class Reference
{
    [BsonId]
    public ObjectId Id { get; set; }

    [BsonElement("name")]
    public string Name { get; set; } = "";

    [BsonElement("cargo")]
    [BsonIgnoreIfNull]
    public string? Cargo { get; set; }

    [BsonElement("telefone")]
    [BsonIgnoreIfNull]
    public string? Telefone { get; set; }

    /// <summary><c>funcionario</c> | <c>externa</c></summary>
    [BsonElement("origem")]
    public string Origem { get; set; } = "externa";

    /// <summary>
    /// Linked employee when origem=funcionario. Must be omitted (not null) for
    /// externa rows so the partial unique index on funcionarioId stays correct.
    /// </summary>
    [BsonElement("funcionarioId")]
    [BsonIgnoreIfNull]
    public ObjectId? FuncionarioId { get; set; }

    /// <summary>Indicating reference; null = hierarchy root.</summary>
    [BsonElement("parentId")]
    public ObjectId? ParentId { get; set; }

    [BsonElement("tenantId")]
    [BsonIgnoreIfNull]
    public ObjectId? TenantId { get; set; }

    [BsonElement("createdBy")]
    [BsonIgnoreIfNull]
    public ObjectId? CreatedBy { get; set; }

    [BsonElement("updatedBy")]
    [BsonIgnoreIfNull]
    public ObjectId? UpdatedBy { get; set; }
}
