namespace Organograma.Application.Branding;

public static class BrandingUtils
{
    public static readonly HashSet<string> ColorFields = new(StringComparer.Ordinal)
    {
        "primaryColor", "secondaryColor", "primaryContrast", "headerBg", "headerText",
        "sidebarBg", "sidebarText", "surfaceBg", "pageBg", "textColor", "mutedColor", "borderColor",
    };

    private static readonly System.Text.RegularExpressions.Regex CssColorRe = new(
        @"^(#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|oklab\([^)]+\)|[a-z]+)$",
        System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Compiled);

    public static bool IsValidCssColor(object? value)
    {
        if (value is null) return false;
        var s = Convert.ToString(value)?.Trim();
        return !string.IsNullOrEmpty(s) && CssColorRe.IsMatch(s);
    }

    public static string? SanitizeColor(object? value, string? fallback)
    {
        if (value is null) return fallback;
        var v = Convert.ToString(value)?.Trim();
        if (string.IsNullOrEmpty(v)) return fallback;
        return IsValidCssColor(v) ? v : fallback;
    }

    public static string? SanitizeFontUrl(object? fontUrl, BrandingPolicy policy)
    {
        if (fontUrl is null) return null;
        var raw = Convert.ToString(fontUrl)?.Trim();
        if (string.IsNullOrEmpty(raw)) return null;

        if (!Uri.TryCreate(raw, UriKind.Absolute, out var url)) return null;
        if (url.Scheme is not ("http" or "https")) return null;

        var host = url.Host.ToLowerInvariant();
        var allowed = policy.FontUrlHosts.Select(h => h.ToLowerInvariant()).ToArray();
        if (allowed.Length == 0) return raw;
        var ok = allowed.Any(h => host == h || host.EndsWith($".{h}", StringComparison.Ordinal));
        return ok ? raw : null;
    }

    private static bool SelectorAllowed(string selector, IReadOnlyList<string> allowedPrefixes)
    {
        var s = (selector ?? "").Trim();
        if (s.Length == 0 || s.StartsWith('@')) return false;
        return allowedPrefixes.Any(prefix =>
        {
            var p = prefix.Trim();
            if (p.Length == 0) return false;
            return s == p
                || s.StartsWith(p, StringComparison.Ordinal)
                || s.StartsWith($"{p}.", StringComparison.Ordinal)
                || s.StartsWith($"{p}:", StringComparison.Ordinal)
                || s.StartsWith($"{p}[", StringComparison.Ordinal)
                || s.StartsWith($"{p} ", StringComparison.Ordinal);
        });
    }

    public static string FilterCssBySelectorAllowlist(string? css, IReadOnlyList<string> allowedPrefixes)
    {
        if (string.IsNullOrEmpty(css) || allowedPrefixes.Count == 0) return css ?? "";

        var outList = new List<string>();
        var i = 0;
        var src = css;

        while (i < src.Length)
        {
            if (char.IsWhiteSpace(src[i]))
            {
                i += 1;
                continue;
            }

            if (src[i] == '/' && i + 1 < src.Length && src[i + 1] == '*')
            {
                var end = src.IndexOf("*/", i + 2, StringComparison.Ordinal);
                if (end == -1) break;
                outList.Add(src[i..(end + 2)]);
                i = end + 2;
                continue;
            }

            if (src[i] == '@')
            {
                var brace = src.IndexOf('{', i);
                if (brace == -1) break;
                var header = src[i..brace].Trim();
                var depth = 1;
                var j = brace + 1;
                while (j < src.Length && depth > 0)
                {
                    if (src[j] == '{') depth += 1;
                    else if (src[j] == '}') depth -= 1;
                    j += 1;
                }
                var inner = src[(brace + 1)..(j - 1)];
                if (System.Text.RegularExpressions.Regex.IsMatch(header, @"^@(media|supports)\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                {
                    var filteredInner = FilterCssBySelectorAllowlist(inner, allowedPrefixes);
                    if (!string.IsNullOrWhiteSpace(filteredInner))
                        outList.Add($"{header} {{ {filteredInner} }}");
                }
                i = j;
                continue;
            }

            {
                var brace = src.IndexOf('{', i);
                if (brace == -1) break;
                var selectorsRaw = src[i..brace].Trim();
                var depth = 1;
                var j = brace + 1;
                while (j < src.Length && depth > 0)
                {
                    if (src[j] == '{') depth += 1;
                    else if (src[j] == '}') depth -= 1;
                    j += 1;
                }
                var body = src[(brace + 1)..(j - 1)];
                var kept = selectorsRaw
                    .Split(',')
                    .Select(s => s.Trim())
                    .Where(s => SelectorAllowed(s, allowedPrefixes))
                    .ToArray();
                if (kept.Length > 0)
                    outList.Add($"{string.Join(", ", kept)} {{ {body.Trim()} }}");
                i = j;
            }
        }

        return string.Join('\n', outList);
    }

    public static string? SanitizeCustomCss(object? css, BrandingPolicy policy)
    {
        if (!policy.CustomCssEnabled) return null;
        if (css is null) return null;
        var value = Convert.ToString(css);
        if (string.IsNullOrEmpty(value)) return null;

        if (value.Length > policy.CustomCssMaxLength)
            value = value[..policy.CustomCssMaxLength];

        value = System.Text.RegularExpressions.Regex.Replace(value, @"</?script[^>]*>", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        value = System.Text.RegularExpressions.Regex.Replace(value, @"expression\s*\(", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        value = System.Text.RegularExpressions.Regex.Replace(value, @"url\s*\(\s*['""]?\s*javascript:", "url(", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        value = System.Text.RegularExpressions.Regex.Replace(value, @"@import\b", "/* @import blocked */", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        value = System.Text.RegularExpressions.Regex.Replace(value, @"behavior\s*:", "/* behavior blocked */:", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        value = System.Text.RegularExpressions.Regex.Replace(value, @"-moz-binding\s*:", "/* binding blocked */:", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        value = FilterCssBySelectorAllowlist(value, policy.AllowedSelectors);
        var trimmed = value.Trim();
        return trimmed.Length == 0 ? null : trimmed;
    }

    public static Dictionary<string, object?> FilterEditableBranding(
        IDictionary<string, object?>? incoming,
        BrandingPolicy policy)
    {
        var allowed = new HashSet<string>(policy.EditableFields, StringComparer.Ordinal);
        var output = new Dictionary<string, object?>();
        if (incoming is null) return output;

        foreach (var (key, val) in incoming)
        {
            if (!allowed.Contains(key)) continue;

            if (key == "customCss")
            {
                output["customCss"] = SanitizeCustomCss(val, policy);
                continue;
            }
            if (key == "fontUrl")
            {
                output["fontUrl"] = SanitizeFontUrl(val, policy);
                continue;
            }
            output[key] = val;
        }
        return output;
    }

    public static Dictionary<string, object?> MergeBranding(
        IDictionary<string, object?>? existing,
        IDictionary<string, object?>? incoming,
        BrandingPolicy policy)
    {
        var filtered = FilterEditableBranding(incoming, policy);
        var output = existing is null
            ? new Dictionary<string, object?>()
            : new Dictionary<string, object?>(existing);

        foreach (var (key, val) in filtered)
            output[key] = val;

        return output;
    }

    public static Dictionary<string, object?>? StripCustomCssIfDisabled(
        Dictionary<string, object?>? branding,
        BrandingPolicy policy)
    {
        if (branding is null) return branding;
        if (policy.CustomCssEnabled) return branding;
        var copy = new Dictionary<string, object?>(branding);
        copy.Remove("customCss");
        return copy;
    }
}
