using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Organograma.Domain.Entities;

/// <summary>
/// Mongoose model name <c>Setor</c> pluralizes to collection <c>setors</c>.
/// </summary>
[BsonIgnoreExtraElements]
public sealed class Setor
{
    [BsonId]
    public ObjectId Id { get; set; }

    [BsonElement("nome")]
    public string Nome { get; set; } = "";

    [BsonElement("tipo")]
    public string Tipo { get; set; } = "Setor";

    [BsonElement("parent")]
    [BsonIgnoreIfNull]
    public ObjectId? Parent { get; set; }

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
