using Organograma.Domain;
using MongoDB.Bson;

namespace Organograma.UnitTests;

public class TenantHelpersTests
{
    [Theory]
    [InlineData("acme.localhost", "", "acme")]
    [InlineData("ACME.localhost:5173", "", "acme")]
    [InlineData("localhost", "", null)]
    [InlineData("www.localhost", "", null)]
    [InlineData("api.localhost", "", null)]
    [InlineData("master.localhost", "", null)]
    [InlineData(null, "example.com", null)]
    [InlineData("", "example.com", null)]
    [InlineData("example.com", "example.com", null)]
    [InlineData("www.example.com", "example.com", null)]
    [InlineData("acme.example.com", "example.com", "acme")]
    [InlineData("api.example.com", "example.com", null)]
    [InlineData("foo.bar.example.com", "example.com", null)]
    [InlineData("tenant.app.example.com", "", "tenant")]
    [InlineData("www.app.example.com", "", null)]
    public void ExtractSubdomain_returns_expected(string? hostname, string baseDomain, string? expected)
        => Assert.Equal(expected, TenantHelpers.ExtractSubdomain(hostname, baseDomain));

    [Theory]
    [InlineData("master", true)]
    [InlineData("WWW", true)]
    [InlineData("api", true)]
    [InlineData("acme", false)]
    [InlineData(null, false)]
    [InlineData("", false)]
    public void IsReservedSubdomain_matches_reserved_set(string? slug, bool expected)
        => Assert.Equal(expected, TenantHelpers.IsReservedSubdomain(slug));

    [Fact]
    public void ReservedSubdomains_contains_platform_slugs()
    {
        Assert.Contains("master", TenantHelpers.ReservedSubdomains);
        Assert.Contains("localhost", TenantHelpers.ReservedSubdomains);
        Assert.Contains("admin", TenantHelpers.ReservedSubdomains);
    }

    [Fact]
    public void TenantFilter_empty_when_no_tenant()
        => Assert.Empty(TenantHelpers.TenantFilter(null));

    [Fact]
    public void TenantFilter_uses_in_for_valid_object_id_string()
    {
        var oid = ObjectId.GenerateNewId();
        var filter = TenantHelpers.TenantFilter(oid.ToString());
        Assert.True(filter.Contains("tenantId"));
        var tenantClause = filter["tenantId"].AsBsonDocument;
        Assert.True(tenantClause.Contains("$in"));
        var values = tenantClause["$in"].AsBsonArray;
        Assert.Equal(2, values.Count);
        Assert.Contains(values, v => v.IsObjectId && v.AsObjectId == oid);
        Assert.Contains(values, v => v.IsString && v.AsString == oid.ToString());
    }

    [Fact]
    public void TenantFilter_uses_string_when_not_object_id()
    {
        var filter = TenantHelpers.TenantFilter("legacy-tenant");
        Assert.Equal("legacy-tenant", filter["tenantId"].AsString);
    }

    [Fact]
    public void IdMatchValues_empty_for_null_or_empty()
    {
        Assert.Empty(TenantHelpers.IdMatchValues(null));
        Assert.Empty(TenantHelpers.IdMatchValues(""));
    }

    [Fact]
    public void IdMatchValues_includes_object_id_and_string()
    {
        var oid = ObjectId.GenerateNewId();
        var values = TenantHelpers.IdMatchValues(oid);
        Assert.Equal(2, values.Count);
        Assert.Contains(oid, values);
        Assert.Contains(oid.ToString(), values);
    }

    [Fact]
    public void IdMatchValues_parses_string_object_id()
    {
        var oid = ObjectId.GenerateNewId();
        var values = TenantHelpers.IdMatchValues(oid.ToString());
        Assert.Contains(oid.ToString(), values);
        Assert.Contains(oid, values);
    }

    [Fact]
    public void IdsMatchValues_dedupes_across_inputs()
    {
        var oid = ObjectId.GenerateNewId();
        var values = TenantHelpers.IdsMatchValues(new object[] { oid, oid.ToString() });
        Assert.Equal(2, values.Count);
    }

    [Theory]
    [InlineData("abc", "users", "tenant:abc:users")]
    [InlineData(null, "users", "users")]
    public void CacheKey_prefixes_tenant_when_present(string? tenantId, string key, string expected)
        => Assert.Equal(expected, TenantHelpers.CacheKey(tenantId, key));

    [Fact]
    public void ToObjectId_parses_valid_inputs()
    {
        var oid = ObjectId.GenerateNewId();
        Assert.Equal(oid, TenantHelpers.ToObjectId(oid));
        Assert.Equal(oid, TenantHelpers.ToObjectId(oid.ToString()));
        Assert.Null(TenantHelpers.ToObjectId(null));
        Assert.Null(TenantHelpers.ToObjectId("not-an-id"));
    }
}
