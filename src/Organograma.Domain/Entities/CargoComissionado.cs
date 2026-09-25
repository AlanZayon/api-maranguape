using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Organograma.Domain.Entities;

/// <summary>
/// Legacy Mongoose model name <c>Cargocomissionado</c> → collection <c>cargocomissionados</c>.
/// </summary>
[BsonIgnoreExtraElements]
public sealed class CargoComissionado
{
    [BsonId]
    public ObjectId Id { get; set; }

    [BsonElement("tipo")]
    public string Tipo { get; set; } = "";

    [BsonElement("cargo")]
    public string Cargo { get; set; } = "";

    [BsonElement("simbologia")]
    public string Simbologia { get; set; } = "";

    [BsonElement("aDefinir")]
    public double ADefinir { get; set; }

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
