using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Organograma.Domain.Entities;

[BsonIgnoreExtraElements]
public sealed class AuditLog
{
    [BsonId]
    public ObjectId Id { get; set; }

    [BsonElement("tenantId")]
    [BsonIgnoreIfNull]
    public ObjectId? TenantId { get; set; }

    [BsonElement("userId")]
    [BsonIgnoreIfNull]
    public ObjectId? UserId { get; set; }

    [BsonElement("action")]
    public string Action { get; set; } = "";

    [BsonElement("entity")]
    public string Entity { get; set; } = "";

    [BsonElement("entityId")]
    [BsonIgnoreIfNull]
    public string? EntityId { get; set; }

    [BsonElement("meta")]
    public BsonDocument Meta { get; set; } = new();

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
