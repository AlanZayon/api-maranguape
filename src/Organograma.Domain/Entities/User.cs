using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Organograma.Domain.Entities;

[BsonIgnoreExtraElements]
public sealed class User
{
    [BsonId]
    public ObjectId Id { get; set; }

    /// <summary>Login id (unique string, not Mongo _id).</summary>
    [BsonElement("id")]
    public string LoginId { get; set; } = "";

    [BsonElement("username")]
    public string Username { get; set; } = "";

    [BsonElement("passwordHash")]
    public string PasswordHash { get; set; } = "";

    [BsonElement("role")]
    public string Role { get; set; } = Roles.User;

    [BsonElement("tenantId")]
    [BsonIgnoreIfNull]
    public ObjectId? TenantId { get; set; }

    [BsonElement("lastValidToken")]
    public string? LastValidToken { get; set; }

    [BsonElement("tokenExpiresAt")]
    public DateTime? TokenExpiresAt { get; set; }

    [BsonElement("createdBy")]
    [BsonIgnoreIfNull]
    public ObjectId? CreatedBy { get; set; }

    [BsonElement("updatedBy")]
    [BsonIgnoreIfNull]
    public ObjectId? UpdatedBy { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
