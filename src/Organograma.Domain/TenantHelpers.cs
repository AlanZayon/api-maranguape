using MongoDB.Bson;

namespace Organograma.Domain;

public static class TenantHelpers
{
    public static readonly HashSet<string> ReservedSubdomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "master", "www", "app", "api", "localhost", "admin", "static", "assets",
    };

    public static ObjectId? ToObjectId(object? id)
    {
        if (id is null) return null;
        if (id is ObjectId oid) return oid;
        var s = Convert.ToString(id);
        if (string.IsNullOrWhiteSpace(s)) return null;
        return ObjectId.TryParse(s, out var parsed) ? parsed : null;
    }

    /// <summary>
    /// Tenant match that tolerates legacy docs where tenantId was stored as a
    /// string instead of ObjectId.
    /// </summary>
    public static BsonDocument TenantFilter(string? tenantId)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return new BsonDocument();

        var oid = ToObjectId(tenantId);
        var asString = tenantId;
        if (oid is not null && oid.Value.ToString() == asString)
        {
            return new BsonDocument(
                "tenantId",
                new BsonDocument("$in", new BsonArray { oid.Value, asString }));
        }

        return new BsonDocument("tenantId", oid is not null ? (BsonValue)oid.Value : asString);
    }

    public static IReadOnlyList<object> IdMatchValues(object? id)
    {
        if (id is null || (id is string s && s.Length == 0)) return [];
        if (id is ObjectId oid) return [oid, oid.ToString()];

        var asString = Convert.ToString(id) ?? "";
        var values = new List<object> { asString };
        if (ObjectId.TryParse(asString, out var parsed))
            values.Add(parsed);
        return values;
    }

    public static IReadOnlyList<object> IdsMatchValues(object? ids)
    {
        IEnumerable<object?> arr = ids is System.Collections.IEnumerable enumerable and not string
            ? enumerable.Cast<object?>()
            : [ids];

        var outList = new List<object>();
        var seen = new HashSet<string>();
        foreach (var id in arr)
        {
            foreach (var v in IdMatchValues(id))
            {
                var key = $"{v.GetType().Name}:{v}";
                if (!seen.Add(key)) continue;
                outList.Add(v);
            }
        }
        return outList;
    }

    public static string CacheKey(string? tenantId, string key)
        => tenantId is not null ? $"tenant:{tenantId}:{key}" : key;

    public static string? ExtractSubdomain(string? hostname, string baseDomain)
    {
        if (string.IsNullOrWhiteSpace(hostname)) return null;
        var host = hostname.Split(':')[0].ToLowerInvariant().Trim();
        if (host.Length == 0) return null;

        if (host.EndsWith(".localhost", StringComparison.Ordinal) || host == "localhost")
        {
            if (host == "localhost") return null;
            var sub = host[..^".localhost".Length];
            return sub.Length > 0 && !ReservedSubdomains.Contains(sub) ? sub : null;
        }

        if (!string.IsNullOrWhiteSpace(baseDomain))
        {
            var bas = baseDomain.ToLowerInvariant().TrimStart('.');
            if (host == bas || host == $"www.{bas}") return null;
            if (host.EndsWith($".{bas}", StringComparison.Ordinal))
            {
                var sub = host[..^(bas.Length + 1)];
                if (string.IsNullOrEmpty(sub) || sub.Contains('.')) return null;
                return ReservedSubdomains.Contains(sub) ? null : sub;
            }
            return null;
        }

        var parts = host.Split('.');
        if (parts.Length >= 3)
        {
            var sub = parts[0];
            return ReservedSubdomains.Contains(sub) ? null : sub;
        }
        return null;
    }

    public static bool IsReservedSubdomain(string? slug)
        => ReservedSubdomains.Contains((slug ?? "").ToLowerInvariant());
}
