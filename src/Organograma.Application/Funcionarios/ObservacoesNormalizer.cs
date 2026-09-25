using MongoDB.Bson;

namespace Organograma.Application.Funcionarios;

public static class ObservacoesNormalizer
{
    public sealed class NormalizedObservacao
    {
        public string Texto { get; set; } = "";
        public DateTime? CreatedAt { get; set; }
        public object? Id { get; set; }
    }

    public static List<NormalizedObservacao> Normalize(
        IEnumerable<object?>? observacoes,
        bool assignMissingDate = true)
    {
        if (observacoes is null) return [];

        var result = new List<NormalizedObservacao>();
        foreach (var raw in observacoes)
        {
            if (raw is null) continue;

            if (raw is string s)
            {
                var texto = s.Trim();
                if (texto.Length == 0) continue;
                result.Add(new NormalizedObservacao { Texto = texto, CreatedAt = null });
                continue;
            }

            if (raw is Dictionary<string, object?> dict)
            {
                var texto = Convert.ToString(dict.GetValueOrDefault("texto")
                                             ?? dict.GetValueOrDefault("text")
                                             ?? "")?.Trim() ?? "";
                if (texto.Length == 0) continue;

                DateTime? createdAt = null;
                var rawDate = dict.GetValueOrDefault("createdAt") ?? dict.GetValueOrDefault("data");
                if (rawDate is not null)
                {
                    if (rawDate is DateTime dt) createdAt = dt;
                    else if (DateTime.TryParse(Convert.ToString(rawDate), out var parsed))
                        createdAt = parsed;
                }
                else if (assignMissingDate)
                {
                    createdAt = DateTime.UtcNow;
                }

                var obs = new NormalizedObservacao { Texto = texto, CreatedAt = createdAt };
                if (dict.TryGetValue("_id", out var id) && id is not null)
                    obs.Id = id;
                result.Add(obs);
            }
        }
        return result;
    }

    public static List<BsonValue> ToBsonValues(IEnumerable<NormalizedObservacao> items)
    {
        var list = new List<BsonValue>();
        foreach (var o in items)
        {
            var doc = new BsonDocument
            {
                ["texto"] = o.Texto,
                ["createdAt"] = o.CreatedAt.HasValue
                    ? (BsonValue)o.CreatedAt.Value
                    : BsonNull.Value,
            };
            if (o.Id is not null)
            {
                if (o.Id is ObjectId oid) doc["_id"] = oid;
                else if (ObjectId.TryParse(Convert.ToString(o.Id), out var parsed))
                    doc["_id"] = parsed;
            }
            list.Add(doc);
        }
        return list;
    }
}
