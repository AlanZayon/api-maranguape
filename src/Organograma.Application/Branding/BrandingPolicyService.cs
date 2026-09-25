using Organograma.Application.Options;
using Microsoft.Extensions.Options;

namespace Organograma.Application.Branding;

public sealed class BrandingPolicy
{
    public bool CustomCssEnabled { get; init; }
    public int CustomCssMaxLength { get; init; }
    public IReadOnlyList<string> EditableFields { get; init; } = [];
    public IReadOnlyList<string> AllowedSelectors { get; init; } = [];
    public IReadOnlyList<string> FontUrlHosts { get; init; } = [];
    public int BrandingAssetMaxBytes { get; init; }
}

public sealed class BrandingPolicyService(IOptions<BrandingPolicyOptions> options)
{
    private readonly BrandingPolicyOptions _options = options.Value;

    public BrandingPolicy GetPolicy()
    {
        return new BrandingPolicy
        {
            CustomCssEnabled = _options.CustomCssEnabled,
            CustomCssMaxLength = _options.CustomCssMaxLength,
            EditableFields = SplitCsv(_options.EditableFields),
            AllowedSelectors = SplitCsv(_options.AllowedSelectors),
            FontUrlHosts = SplitCsv(_options.FontUrlHosts),
            BrandingAssetMaxBytes = _options.BrandingAssetMaxBytes,
        };
    }

    private static string[] SplitCsv(string? value)
        => (value ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(s => s.Length > 0)
            .ToArray();
}
