using Organograma.Domain.Serialization;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using MongoDB.Bson.Serialization;

namespace Organograma.UnitTests;

public class FimContratoTests
{
    [Fact]
    public void Parse_null_empty_and_indeterminado()
    {
        Assert.True(FimContrato.Parse(null)!.IsNull);
        Assert.True(FimContrato.Parse("")!.IsNull);
        Assert.True(FimContrato.Parse("indeterminado")!.IsIndeterminado);
        Assert.True(FimContrato.Parse("INDETERMINADO")!.IsIndeterminado);
    }

    [Fact]
    public void Parse_date_string_returns_utc_date()
    {
        var parsed = FimContrato.Parse("2024-06-15T00:00:00Z");
        Assert.NotNull(parsed);
        Assert.False(parsed!.IsIndeterminado);
        Assert.Equal(new DateTime(2024, 6, 15, 0, 0, 0, DateTimeKind.Utc), parsed.Date);
    }

    [Fact]
    public void ToApiValue_matches_nest_shapes()
    {
        Assert.Equal("indeterminado", FimContrato.Indeterminado.ToApiValue());
        Assert.Null(FimContrato.Null.ToApiValue());
        var date = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        Assert.Equal(date, FimContrato.FromDate(date).ToApiValue());
    }

    [Fact]
    public void Serializer_roundtrips_null_indeterminado_and_date()
    {
        var serializer = new FimContratoSerializer();

        Assert.True(Roundtrip(serializer, FimContrato.Null)!.IsNull);
        Assert.True(Roundtrip(serializer, FimContrato.Indeterminado)!.IsIndeterminado);

        var date = new DateTime(2023, 3, 10, 12, 0, 0, DateTimeKind.Utc);
        var roundtripped = Roundtrip(serializer, FimContrato.FromDate(date));
        Assert.NotNull(roundtripped);
        Assert.Equal(date, roundtripped!.Date!.Value.ToUniversalTime());
    }

    [Fact]
    public void Serializer_deserializes_string_date_null_and_unknown()
    {
        var serializer = new FimContratoSerializer();

        Assert.True(DeserializeField(serializer, BsonNull.Value)!.IsNull);
        Assert.True(DeserializeField(serializer, new BsonString("indeterminado"))!.IsIndeterminado);
        Assert.True(DeserializeField(serializer, new BsonString("not-a-date"))!.IsNull);

        var parsed = DeserializeField(serializer, new BsonString("2022-01-02T03:04:05Z"));
        Assert.Equal(new DateTime(2022, 1, 2, 3, 4, 5, DateTimeKind.Utc), parsed!.Date);
    }

    private static FimContrato? Roundtrip(FimContratoSerializer serializer, FimContrato? value)
    {
        using var stream = new MemoryStream();
        using (var writer = new BsonBinaryWriter(stream))
        {
            writer.WriteStartDocument();
            writer.WriteName("v");
            serializer.Serialize(BsonSerializationContext.CreateRoot(writer), value);
            writer.WriteEndDocument();
        }

        stream.Position = 0;
        using var reader = new BsonBinaryReader(stream);
        reader.ReadStartDocument();
        reader.ReadName("v");
        return serializer.Deserialize(BsonDeserializationContext.CreateRoot(reader));
    }

    private static FimContrato? DeserializeField(FimContratoSerializer serializer, BsonValue value)
    {
        var doc = new BsonDocument("v", value);
        using var stream = new MemoryStream();
        using (var writer = new BsonBinaryWriter(stream))
            BsonSerializer.Serialize(writer, doc);

        stream.Position = 0;
        using var reader = new BsonBinaryReader(stream);
        reader.ReadStartDocument();
        reader.ReadName("v");
        return serializer.Deserialize(BsonDeserializationContext.CreateRoot(reader));
    }
}
