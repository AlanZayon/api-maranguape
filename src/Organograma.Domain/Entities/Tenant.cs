using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Organograma.Domain.Entities;

public sealed class Branding
{
    [BsonElement("logoUrl")]
    public string? LogoUrl { get; set; }

    [BsonElement("faviconUrl")]
    public string? FaviconUrl { get; set; }

    [BsonElement("displayName")]
    public string? DisplayName { get; set; }

    [BsonElement("primaryColor")]
    public string PrimaryColor { get; set; } = "#1a5f2a";

    [BsonElement("secondaryColor")]
    public string? SecondaryColor { get; set; }

    [BsonElement("primaryContrast")]
    public string PrimaryContrast { get; set; } = "#ffffff";

    [BsonElement("headerBg")]
    public string HeaderBg { get; set; } = "#1b1f24";

    [BsonElement("headerText")]
    public string HeaderText { get; set; } = "#f8f9fa";

    [BsonElement("sidebarBg")]
    public string SidebarBg { get; set; } = "#ffffff";

    [BsonElement("sidebarText")]
    public string SidebarText { get; set; } = "#343a40";

    [BsonElement("surfaceBg")]
    public string SurfaceBg { get; set; } = "#ffffff";

    [BsonElement("pageBg")]
    public string PageBg { get; set; } = "#f3f4f6";

    [BsonElement("textColor")]
    public string TextColor { get; set; } = "#212529";

    [BsonElement("mutedColor")]
    public string MutedColor { get; set; } = "#6c757d";

    [BsonElement("borderColor")]
    public string BorderColor { get; set; } = "#dee2e6";

    [BsonElement("fontFamily")]
    public string? FontFamily { get; set; }

    [BsonElement("fontUrl")]
    public string? FontUrl { get; set; }

    [BsonElement("themeMode")]
    public string ThemeMode { get; set; } = "light";

    [BsonElement("customCss")]
    public string? CustomCss { get; set; }
}

public sealed class TenantSettings
{
    [BsonElement("vocabulary")]
    public Dictionary<string, object?> Vocabulary { get; set; } = new();

    [BsonElement("seedOnCreate")]
    public bool SeedOnCreate { get; set; } = true;
}

[BsonIgnoreExtraElements]
public sealed class Tenant
{
    [BsonId]
    public ObjectId Id { get; set; }

    [BsonElement("slug")]
    public string Slug { get; set; } = "";

    [BsonElement("name")]
    public string Name { get; set; } = "";

    [BsonElement("branding")]
    public Branding Branding { get; set; } = new();

    [BsonElement("settings")]
    public TenantSettings Settings { get; set; } = new();

    [BsonElement("status")]
    public string Status { get; set; } = "active";

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
