using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Organograma.Domain.Entities;

/// <summary>
/// Legacy model name <c>Simbologia</c> — collection pinned to <c>simbologias</c>.
/// </summary>
[BsonIgnoreExtraElements]
public sealed class LimiteSimbologia
{
    [BsonId]
    public ObjectId Id { get; set; }

    [BsonElement("simbologia")]
    public string Simbologia { get; set; } = "";

    [BsonElement("limite")]
    public int Limite { get; set; }

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
