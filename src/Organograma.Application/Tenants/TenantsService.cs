using Organograma.Application.Abstractions;
using Organograma.Application.Branding;
using Organograma.Domain;
using Organograma.Domain.Entities;
using MongoDB.Bson;

namespace Organograma.Application.Tenants;

public sealed class TenantAdminDto
{
    public string? Id { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public sealed class CreateTenantDto
{
    public string Slug { get; set; } = "";
    public string Name { get; set; } = "";
    public Dictionary<string, object?>? Branding { get; set; }
    public TenantSettingsDto? Settings { get; set; }
    public string? Status { get; set; }
    public TenantAdminDto? Admin { get; set; }
}

public sealed class UpdateTenantDto
{
    public string? Name { get; set; }
    public string? Status { get; set; }
    public Dictionary<string, object?>? Branding { get; set; }
    public TenantSettingsDto? Settings { get; set; }
}

public sealed class TenantSettingsDto
{
    public Dictionary<string, string>? Vocabulary { get; set; }
    public bool? SeedOnCreate { get; set; }
}

public sealed class TenantsService(
    ITenantsRepository tenantsRepository,
    IUserRepository userRepository,
    IS3Service s3Service,
    BrandingPolicyService brandingPolicyService)
{
    private static readonly Dictionary<string, string> DefaultVocabulary = new()
    {
        ["funcionario"] = "Funcionário",
        ["setor"] = "Setor",
        ["subsetor"] = "Subsetor",
        ["cargo"] = "Cargo",
        ["referencia"] = "Referência",
    };

    public async Task<object> GetByIdAsync(string id, CancellationToken ct = default)
    {
        var tenant = await tenantsRepository.FindByIdAsync(id, ct)
            ?? throw new AppException("Tenant não encontrado", 404, "TENANT_NOT_FOUND");
        return await BrandingPayloadAsync(tenant, ct);
    }

    public async Task<object> GetBySlugAsync(string slug, CancellationToken ct = default)
    {
        var tenant = await tenantsRepository.FindBySlugAsync(slug.ToLowerInvariant().Trim(), activeOnly: true, ct)
            ?? throw new AppException("Tenant não encontrado", 404, "TENANT_NOT_FOUND");

        var policy = brandingPolicyService.GetPolicy();
        var branding = BrandingToDict(tenant.Branding);
        branding["logoUrl"] = await ResolveMediaUrlAsync(branding.GetValueOrDefault("logoUrl"), ct);
        branding["faviconUrl"] = await ResolveMediaUrlAsync(branding.GetValueOrDefault("faviconUrl"), ct);
        branding = BrandingUtils.StripCustomCssIfDisabled(branding, policy) ?? branding;

        return new
        {
            slug = tenant.Slug,
            name = tenant.Name,
            branding,
            settings = new
            {
                vocabulary = tenant.Settings.Vocabulary
                    .ToDictionary(kv => kv.Key, kv => kv.Value?.ToString() ?? ""),
            },
        };
    }

    public async Task<IReadOnlyList<object>> ListAsync(CancellationToken ct = default)
    {
        var tenants = await tenantsRepository.ListAsync(ct);
        var result = new List<object>();
        foreach (var t in tenants)
            result.Add(await BrandingPayloadAsync(t, ct));
        return result;
    }

    public async Task<object> CreateAsync(CreateTenantDto data, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(data.Slug) || string.IsNullOrWhiteSpace(data.Name))
            throw new AppException("slug e name são obrigatórios", 400, "VALIDATION_ERROR");

        var normalizedSlug = data.Slug.ToLowerInvariant().Trim();
        if (TenantHelpers.IsReservedSubdomain(normalizedSlug))
            throw new AppException("Slug reservado pela plataforma", 400, "RESERVED_SLUG");

        if (!System.Text.RegularExpressions.Regex.IsMatch(normalizedSlug, @"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$"))
            throw new AppException("Slug inválido (use letras minúsculas, números e hífens)", 400, "INVALID_SLUG");

        var seedOnCreate = data.Settings?.SeedOnCreate ?? true;
        var vocabulary = new Dictionary<string, object?>(DefaultVocabulary.ToDictionary(kv => kv.Key, kv => (object?)kv.Value));
        if (data.Settings?.Vocabulary is not null)
        {
            foreach (var kv in data.Settings.Vocabulary)
                vocabulary[kv.Key] = kv.Value;
        }

        var now = DateTime.UtcNow;
        Tenant tenant;
        try
        {
            tenant = new Tenant
            {
                Id = ObjectId.GenerateNewId(),
                Slug = normalizedSlug,
                Name = data.Name,
                Branding = NormalizeBrandingToEntity(data.Branding, data.Name),
                Settings = new TenantSettings
                {
                    Vocabulary = vocabulary,
                    SeedOnCreate = seedOnCreate,
                },
                Status = data.Status ?? "active",
                CreatedAt = now,
                UpdatedAt = now,
            };
            tenant = await tenantsRepository.CreateAsync(tenant, ct);
        }
        catch (MongoDB.Driver.MongoWriteException ex) when (ex.WriteError?.Code == 11000)
        {
            throw new AppException("Slug de tenant já existe", 409, "CONFLICT");
        }

        object? firstAdmin = null;
        if (!string.IsNullOrWhiteSpace(data.Admin?.Username) && !string.IsNullOrWhiteSpace(data.Admin?.Password))
        {
            var adminUser = new User
            {
                LoginId = string.IsNullOrWhiteSpace(data.Admin.Id) ? Guid.NewGuid().ToString() : data.Admin.Id,
                Username = data.Admin.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(data.Admin.Password, workFactor: 10),
                Role = Roles.Owner,
                TenantId = tenant.Id,
                CreatedAt = now,
                UpdatedAt = now,
            };
            adminUser = await userRepository.CreateAsync(adminUser, ct);
            firstAdmin = new
            {
                _id = adminUser.Id.ToString(),
                id = adminUser.LoginId,
                username = adminUser.Username,
                role = adminUser.Role,
                tenantId = adminUser.TenantId?.ToString(),
                createdAt = adminUser.CreatedAt,
                updatedAt = adminUser.UpdatedAt,
            };
        }

        // seedDefaults (setores/simbologia) deferred until those modules are ported.

        return new
        {
            tenant = await BrandingPayloadAsync(tenant, ct),
            admin = firstAdmin,
        };
    }

    public async Task<object> UpdateAsync(string id, UpdateTenantDto data, CancellationToken ct = default)
    {
        var tenant = await tenantsRepository.FindByIdAsync(id, ct)
            ?? throw new AppException("Tenant não encontrado", 404, "TENANT_NOT_FOUND");

        if (data.Name is not null) tenant.Name = data.Name;
        if (data.Status is not null)
        {
            if (data.Status is not ("active" or "inactive"))
                throw new AppException("Status inválido", 400, "VALIDATION_ERROR");
            tenant.Status = data.Status;
        }

        if (data.Branding is not null)
        {
            var policy = brandingPolicyService.GetPolicy();
            var existing = BrandingToDict(tenant.Branding);
            var merged = BrandingUtils.MergeBranding(existing, data.Branding, policy);
            tenant.Branding = NormalizeBrandingToEntity(merged, data.Name ?? tenant.Name, filterEditable: false);
        }

        if (data.Settings is not null)
        {
            if (data.Settings.Vocabulary is not null)
            {
                foreach (var kv in data.Settings.Vocabulary)
                    tenant.Settings.Vocabulary[kv.Key] = kv.Value;
            }
            if (data.Settings.SeedOnCreate is not null)
                tenant.Settings.SeedOnCreate = data.Settings.SeedOnCreate.Value;
        }

        tenant.UpdatedAt = DateTime.UtcNow;
        tenant = await tenantsRepository.UpdateAsync(tenant, ct);
        return await BrandingPayloadAsync(tenant, ct);
    }

    public Task<object> UpdateMeAsync(string tenantId, UpdateTenantDto data, CancellationToken ct = default)
    {
        var allowed = new UpdateTenantDto
        {
            Branding = data.Branding,
            Settings = data.Settings is null
                ? null
                : new TenantSettingsDto { Vocabulary = data.Settings.Vocabulary },
        };
        return UpdateAsync(tenantId, allowed, ct);
    }

    public Task<object> DeactivateAsync(string id, CancellationToken ct = default)
        => UpdateAsync(id, new UpdateTenantDto { Status = "inactive" }, ct);

    public async Task<object> UploadAssetAsync(
        string tenantId,
        Stream? fileStream,
        string contentType,
        long fileSize,
        string kind = "logo",
        CancellationToken ct = default)
    {
        if (fileStream is null)
            throw new AppException("Arquivo obrigatório", 400, "VALIDATION_ERROR");
        if (kind is not ("logo" or "favicon"))
            throw new AppException("kind deve ser logo ou favicon", 400, "VALIDATION_ERROR");

        var policy = brandingPolicyService.GetPolicy();
        if (fileSize > policy.BrandingAssetMaxBytes)
            throw new AppException($"Arquivo excede o limite de {policy.BrandingAssetMaxBytes} bytes", 400, "FILE_TOO_LARGE");

        if (!contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            throw new AppException("Arquivo deve ser uma imagem", 400, "INVALID_FILE_TYPE");

        var tenant = await tenantsRepository.FindByIdAsync(tenantId, ct)
            ?? throw new AppException("Tenant não encontrado", 404, "TENANT_NOT_FOUND");

        var key = await s3Service.UploadFileAsync(fileStream, contentType, $"branding/{kind}", tenantId, ct);
        var url = await s3Service.GerarUrlPreAssinadaAsync(key, ct);

        if (kind == "logo") tenant.Branding.LogoUrl = key;
        else tenant.Branding.FaviconUrl = key;

        tenant.UpdatedAt = DateTime.UtcNow;
        tenant = await tenantsRepository.UpdateAsync(tenant, ct);

        return new
        {
            kind,
            key,
            url,
            tenant = await BrandingPayloadAsync(tenant, ct),
        };
    }

    private async Task<object> BrandingPayloadAsync(Tenant tenant, CancellationToken ct)
    {
        var policy = brandingPolicyService.GetPolicy();
        var branding = BrandingToDict(tenant.Branding);
        branding["logoUrl"] = await ResolveMediaUrlAsync(branding.GetValueOrDefault("logoUrl"), ct);
        branding["faviconUrl"] = await ResolveMediaUrlAsync(branding.GetValueOrDefault("faviconUrl"), ct);
        branding = BrandingUtils.StripCustomCssIfDisabled(branding, policy) ?? branding;

        return new
        {
            slug = tenant.Slug,
            name = tenant.Name,
            branding,
            settings = new
            {
                vocabulary = tenant.Settings.Vocabulary,
                seedOnCreate = tenant.Settings.SeedOnCreate,
            },
            status = tenant.Status,
            _id = tenant.Id.ToString(),
            createdAt = tenant.CreatedAt,
            updatedAt = tenant.UpdatedAt,
        };
    }

    private async Task<object?> ResolveMediaUrlAsync(object? value, CancellationToken ct)
    {
        if (value is null) return null;
        var raw = Convert.ToString(value);
        if (string.IsNullOrEmpty(raw)) return null;
        if (raw.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || raw.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return raw;
        try
        {
            return await s3Service.GerarUrlPreAssinadaAsync(raw, ct) ?? raw;
        }
        catch
        {
            return raw;
        }
    }

    private Domain.Entities.Branding NormalizeBrandingToEntity(
        IDictionary<string, object?>? branding,
        string? name,
        bool filterEditable = true)
    {
        var policy = brandingPolicyService.GetPolicy();
        var source = filterEditable
            ? BrandingUtils.FilterEditableBranding(branding, policy)
            : new Dictionary<string, object?>(branding ?? new Dictionary<string, object?>());

        object? Pick(string key, object? fallback = null)
            => source.TryGetValue(key, out var v) ? v
                : (!filterEditable && branding is not null && branding.TryGetValue(key, out var b) ? b : fallback);

        string? secondaryRaw = Pick("secondaryColor")?.ToString();
        string? customCss;
        if (!policy.CustomCssEnabled)
        {
            customCss = filterEditable
                ? null
                : (branding is not null && branding.TryGetValue("customCss", out var existingCss)
                    ? existingCss?.ToString()
                    : null);
        }
        else
            customCss = BrandingUtils.SanitizeCustomCss(Pick("customCss"), policy);

        return new Domain.Entities.Branding
        {
            LogoUrl = Pick("logoUrl")?.ToString(),
            FaviconUrl = Pick("faviconUrl")?.ToString(),
            PrimaryColor = BrandingUtils.SanitizeColor(Pick("primaryColor"), "#1a5f2a") ?? "#1a5f2a",
            SecondaryColor = string.IsNullOrEmpty(secondaryRaw)
                ? null
                : BrandingUtils.SanitizeColor(secondaryRaw, null),
            PrimaryContrast = BrandingUtils.SanitizeColor(Pick("primaryContrast"), "#ffffff") ?? "#ffffff",
            HeaderBg = BrandingUtils.SanitizeColor(Pick("headerBg"), "#1b1f24") ?? "#1b1f24",
            HeaderText = BrandingUtils.SanitizeColor(Pick("headerText"), "#f8f9fa") ?? "#f8f9fa",
            SidebarBg = BrandingUtils.SanitizeColor(Pick("sidebarBg"), "#ffffff") ?? "#ffffff",
            SidebarText = BrandingUtils.SanitizeColor(Pick("sidebarText"), "#343a40") ?? "#343a40",
            SurfaceBg = BrandingUtils.SanitizeColor(Pick("surfaceBg"), "#ffffff") ?? "#ffffff",
            PageBg = BrandingUtils.SanitizeColor(Pick("pageBg"), "#f3f4f6") ?? "#f3f4f6",
            TextColor = BrandingUtils.SanitizeColor(Pick("textColor"), "#212529") ?? "#212529",
            MutedColor = BrandingUtils.SanitizeColor(Pick("mutedColor"), "#6c757d") ?? "#6c757d",
            BorderColor = BrandingUtils.SanitizeColor(Pick("borderColor"), "#dee2e6") ?? "#dee2e6",
            FontFamily = Pick("fontFamily")?.ToString(),
            FontUrl = BrandingUtils.SanitizeFontUrl(Pick("fontUrl"), policy),
            ThemeMode = Pick("themeMode")?.ToString() == "dark" ? "dark" : "light",
            CustomCss = customCss,
            DisplayName = Pick("displayName")?.ToString() ?? name,
        };
    }

    private static Dictionary<string, object?> BrandingToDict(Domain.Entities.Branding b) => new()
    {
        ["logoUrl"] = b.LogoUrl,
        ["faviconUrl"] = b.FaviconUrl,
        ["displayName"] = b.DisplayName,
        ["primaryColor"] = b.PrimaryColor,
        ["secondaryColor"] = b.SecondaryColor,
        ["primaryContrast"] = b.PrimaryContrast,
        ["headerBg"] = b.HeaderBg,
        ["headerText"] = b.HeaderText,
        ["sidebarBg"] = b.SidebarBg,
        ["sidebarText"] = b.SidebarText,
        ["surfaceBg"] = b.SurfaceBg,
        ["pageBg"] = b.PageBg,
        ["textColor"] = b.TextColor,
        ["mutedColor"] = b.MutedColor,
        ["borderColor"] = b.BorderColor,
        ["fontFamily"] = b.FontFamily,
        ["fontUrl"] = b.FontUrl,
        ["themeMode"] = b.ThemeMode,
        ["customCss"] = b.CustomCss,
    };
}
