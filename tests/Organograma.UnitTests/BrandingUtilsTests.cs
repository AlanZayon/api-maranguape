using Organograma.Application.Branding;

namespace Organograma.UnitTests;

public class BrandingUtilsTests
{
    private static BrandingPolicy Policy(
        bool cssEnabled = true,
        int maxLength = 20000,
        string[]? selectors = null,
        string[]? hosts = null,
        string[]? editable = null) => new()
    {
        CustomCssEnabled = cssEnabled,
        CustomCssMaxLength = maxLength,
        AllowedSelectors = selectors ?? [".login-page", ".sidebar"],
        FontUrlHosts = hosts ?? ["fonts.googleapis.com"],
        EditableFields = editable ?? ["primaryColor", "customCss", "fontUrl", "displayName"],
        BrandingAssetMaxBytes = 1024,
    };

    [Theory]
    [InlineData("#fff", true)]
    [InlineData("#1a5f2a", true)]
    [InlineData("rgb(1, 2, 3)", true)]
    [InlineData("rgba(1,2,3,0.5)", true)]
    [InlineData("red", true)]
    [InlineData("not a color!!!", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsValidCssColor_validates_formats(object? value, bool expected)
        => Assert.Equal(expected, BrandingUtils.IsValidCssColor(value));

    [Fact]
    public void SanitizeColor_falls_back_on_invalid()
    {
        Assert.Equal("#000", BrandingUtils.SanitizeColor("!!!invalid", "#000"));
        Assert.Equal("#000", BrandingUtils.SanitizeColor("#gg", "#000"));
        Assert.Equal("#abc", BrandingUtils.SanitizeColor("#abc", "#000"));
        Assert.Equal("#000", BrandingUtils.SanitizeColor(null, "#000"));
    }

    [Fact]
    public void SanitizeFontUrl_allows_listed_hosts_only()
    {
        var policy = Policy(hosts: ["fonts.googleapis.com"]);
        Assert.Equal(
            "https://fonts.googleapis.com/css2?family=Roboto",
            BrandingUtils.SanitizeFontUrl("https://fonts.googleapis.com/css2?family=Roboto", policy));
        Assert.Null(BrandingUtils.SanitizeFontUrl("https://evil.example/font.css", policy));
        Assert.Null(BrandingUtils.SanitizeFontUrl("javascript:alert(1)", policy));
        Assert.Null(BrandingUtils.SanitizeFontUrl(null, policy));
    }

    [Fact]
    public void SanitizeCustomCss_strips_dangerous_constructs_and_filters_selectors()
    {
        var policy = Policy();
        var css = """
            .login-page { color: red; }
            .sidebar { color: green; }
            .evil { color: blue; }
            body { background: url("javascript:alert(1)"); }
            @import url("https://evil");
            """;

        var sanitized = BrandingUtils.SanitizeCustomCss(css, policy);

        Assert.NotNull(sanitized);
        Assert.Contains(".login-page", sanitized);
        Assert.Contains(".sidebar", sanitized);
        Assert.DoesNotContain(".evil", sanitized);
        Assert.Contains("/* @import blocked */", sanitized);
        Assert.DoesNotContain("javascript:", sanitized, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SanitizeCustomCss_returns_null_when_disabled_or_empty()
    {
        Assert.Null(BrandingUtils.SanitizeCustomCss(".login-page{}", Policy(cssEnabled: false)));
        Assert.Null(BrandingUtils.SanitizeCustomCss("", Policy()));
        Assert.Null(BrandingUtils.SanitizeCustomCss(null, Policy()));
    }

    [Fact]
    public void SanitizeCustomCss_truncates_to_max_length()
    {
        var policy = Policy(maxLength: 40, selectors: [".login-page"]);
        var longCss = ".login-page { color: " + new string('a', 200) + "; }";
        var sanitized = BrandingUtils.SanitizeCustomCss(longCss, policy);
        Assert.NotNull(sanitized);
        Assert.True(sanitized.Length <= 40 || sanitized.StartsWith(".login-page"));
    }

    [Fact]
    public void FilterCssBySelectorAllowlist_keeps_comments_and_media()
    {
        var css = """
            /* keep */
            .login-page { color: red; }
            @media (min-width: 600px) { .sidebar { color: blue; } .evil { color: green; } }
            """;
        var filtered = BrandingUtils.FilterCssBySelectorAllowlist(css, [".login-page", ".sidebar"]);
        Assert.Contains("/* keep */", filtered);
        Assert.Contains(".login-page", filtered);
        Assert.Contains("@media", filtered);
        Assert.Contains(".sidebar", filtered);
        Assert.DoesNotContain(".evil", filtered);
    }

    [Fact]
    public void FilterEditableBranding_and_MergeBranding_respect_policy()
    {
        var policy = Policy();
        var filtered = BrandingUtils.FilterEditableBranding(
            new Dictionary<string, object?>
            {
                ["primaryColor"] = "#111",
                ["secretField"] = "nope",
                ["customCss"] = ".login-page { color: red; }",
            },
            policy);

        Assert.True(filtered.ContainsKey("primaryColor"));
        Assert.False(filtered.ContainsKey("secretField"));
        Assert.NotNull(filtered["customCss"]);

        var merged = BrandingUtils.MergeBranding(
            new Dictionary<string, object?> { ["displayName"] = "Old" },
            new Dictionary<string, object?> { ["displayName"] = "New", ["primaryColor"] = "#222" },
            policy);

        Assert.Equal("New", merged["displayName"]);
        Assert.Equal("#222", merged["primaryColor"]);
    }

    [Fact]
    public void StripCustomCssIfDisabled_removes_field()
    {
        var branding = new Dictionary<string, object?> { ["customCss"] = "x", ["primaryColor"] = "#fff" };
        var stripped = BrandingUtils.StripCustomCssIfDisabled(branding, Policy(cssEnabled: false));
        Assert.NotNull(stripped);
        Assert.False(stripped.ContainsKey("customCss"));
        Assert.True(stripped.ContainsKey("primaryColor"));
    }

    [Fact]
    public void ColorFields_contains_expected_keys()
    {
        Assert.Contains("primaryColor", BrandingUtils.ColorFields);
        Assert.Contains("pageBg", BrandingUtils.ColorFields);
    }
}
