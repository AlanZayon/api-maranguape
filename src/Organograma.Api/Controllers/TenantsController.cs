using Organograma.Api.Auth;
using Organograma.Application.Branding;
using Organograma.Application.Tenants;
using Organograma.Domain;
using Microsoft.AspNetCore.Mvc;

namespace Organograma.Api.Controllers;

[ApiController]
[Route("api/tenants")]
public sealed class TenantsController(
    TenantsService tenantsService,
    BrandingPolicyService brandingPolicyService) : ControllerBase
{
    [HttpGet("branding-policy")]
    public IActionResult BrandingPolicy()
    {
        var policy = brandingPolicyService.GetPolicy();
        return Ok(new
        {
            customCssEnabled = policy.CustomCssEnabled,
            customCssMaxLength = policy.CustomCssMaxLength,
            allowedSelectors = policy.AllowedSelectors,
            editableFields = policy.EditableFields,
            fontUrlHosts = policy.FontUrlHosts,
            assetMaxBytes = policy.BrandingAssetMaxBytes,
            colorFields = BrandingUtils.ColorFields.ToArray(),
        });
    }

    [HttpGet("by-slug/{slug}")]
    public async Task<IActionResult> BySlug(string slug, CancellationToken ct)
        => Ok(await tenantsService.GetBySlugAsync(slug, ct));

    [HttpGet("me")]
    [AuthGuard]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var tenantId = HttpContext.GetTenantId();
        if (string.IsNullOrEmpty(tenantId))
            throw new AppException("Nenhum tenant associado ao usuário", 400, "NO_TENANT");
        return Ok(await tenantsService.GetByIdAsync(tenantId, ct));
    }

    [HttpPatch("me")]
    [AuthGuard]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateTenantDto body, CancellationToken ct)
    {
        var tenantId = HttpContext.GetTenantId();
        var user = HttpContext.GetAuthUser();
        if (string.IsNullOrEmpty(tenantId))
            throw new AppException("Nenhum tenant associado ao usuário", 400, "NO_TENANT");
        if (user?.Role == Roles.Superadmin && string.IsNullOrEmpty(user.TenantId))
            throw new AppException("Use PATCH /api/tenants/:id como superadmin", 400, "USE_TENANT_ID");
        return Ok(await tenantsService.UpdateMeAsync(tenantId, body, ct));
    }

    [HttpGet]
    [AuthGuard]
    [Roles(Roles.Superadmin)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var tenants = await tenantsService.ListAsync(ct);
        return Ok(new { tenants });
    }

    [HttpPost]
    [AuthGuard]
    [Roles(Roles.Superadmin)]
    public async Task<IActionResult> Create([FromBody] CreateTenantDto body, CancellationToken ct)
        => Ok(await tenantsService.CreateAsync(body, ct));

    [HttpGet("{id}")]
    [AuthGuard]
    [Roles(Roles.Superadmin)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Ok(await tenantsService.GetByIdAsync(id, ct));

    [HttpPatch("{id}")]
    [AuthGuard]
    [Roles(Roles.Superadmin)]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateTenantDto body, CancellationToken ct)
        => Ok(await tenantsService.UpdateAsync(id, body, ct));

    [HttpDelete("{id}")]
    [AuthGuard]
    [Roles(Roles.Superadmin)]
    public async Task<IActionResult> Deactivate(string id, CancellationToken ct)
        => Ok(await tenantsService.DeactivateAsync(id, ct));

    [HttpPost("{id}/assets")]
    [AuthGuard]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadAsset(
        string id,
        [FromForm] string? kind,
        [FromQuery] string? kindQuery,
        IFormFile? file,
        CancellationToken ct)
    {
        var resolvedKind = kind ?? kindQuery ?? "logo";
        var user = HttpContext.GetAuthUser();
        var requesterTenant = user?.TenantId;

        if (user?.Role != Roles.Superadmin && requesterTenant != id)
            throw new AppException("Acesso negado", 403, "FORBIDDEN");

        await using var stream = file?.OpenReadStream();
        var result = await tenantsService.UploadAssetAsync(
            id,
            stream,
            file?.ContentType ?? "",
            file?.Length ?? 0,
            resolvedKind,
            ct);
        return Ok(result);
    }
}
