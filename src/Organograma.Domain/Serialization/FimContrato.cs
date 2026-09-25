using System.Globalization;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;

namespace Organograma.Domain.Serialization;

/// <summary>
/// Nest stores <c>fimContrato</c> as Date | "indeterminado" | null.
/// </summary>
public sealed class FimContrato
{
    public static FimContrato Null { get; } = new(null, false);
    public static FimContrato Indeterminado { get; } = new(null, true);

    public DateTime? Date { get; }
    public bool IsIndeterminado { get; }
    public bool IsNull => !IsIndeterminado && Date is null;

    private FimContrato(DateTime? date, bool indeterminado)
    {
        Date = date;
        IsIndeterminado = indeterminado;
    }

    public static FimContrato FromDate(DateTime date) => new(date, false);

    public static FimContrato? Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return Null;
        if (string.Equals(value.Trim(), "indeterminado", StringComparison.OrdinalIgnoreCase))
            return Indeterminado;
        if (DateTime.TryParse(value, CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind, out var dt))
            return FromDate(DateTime.SpecifyKind(dt, DateTimeKind.Utc));
        return Null;
    }

    public object? ToApiValue()
    {
        if (IsIndeterminado) return "indeterminado";
        if (Date is null) return null;
        return Date.Value;
    }

    public override string ToString()
        => IsIndeterminado ? "indeterminado" : Date?.ToString("O") ?? "";
}

public sealed class FimContratoSerializer : SerializerBase<FimContrato?>
{
    public override FimContrato? Deserialize(BsonDeserializationContext context, BsonDeserializationArgs args)
    {
        var reader = context.Reader;
        switch (reader.GetCurrentBsonType())
        {
            case BsonType.Null:
                reader.ReadNull();
                return FimContrato.Null;
            case BsonType.String:
            {
                var s = reader.ReadString();
                if (string.Equals(s, "indeterminado", StringComparison.OrdinalIgnoreCase))
                    return FimContrato.Indeterminado;
                if (string.IsNullOrWhiteSpace(s))
                    return FimContrato.Null;
                if (DateTime.TryParse(s, CultureInfo.InvariantCulture,
                        DateTimeStyles.RoundtripKind, out var parsed))
                    return FimContrato.FromDate(DateTime.SpecifyKind(parsed, DateTimeKind.Utc));
                return FimContrato.Null;
            }
            case BsonType.DateTime:
                return FimContrato.FromDate(
                    BsonUtils.ToDateTimeFromMillisecondsSinceEpoch(reader.ReadDateTime()));
            case BsonType.Document:
            {
                // Legacy {$date: ...} style rarely appears via driver; skip
                reader.SkipValue();
                return FimContrato.Null;
            }
            default:
                reader.SkipValue();
                return FimContrato.Null;
        }
    }

    public override void Serialize(BsonSerializationContext context, BsonSerializationArgs args, FimContrato? value)
    {
        var writer = context.Writer;
        if (value is null || value.IsNull)
        {
            writer.WriteNull();
            return;
        }
        if (value.IsIndeterminado)
        {
            writer.WriteString("indeterminado");
            return;
        }
        writer.WriteDateTime(BsonUtils.ToMillisecondsSinceEpoch(value.Date!.Value.ToUniversalTime()));
    }
}
