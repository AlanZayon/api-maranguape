using Organograma.Api.Auth;
using Organograma.Application.Abstractions;
using Organograma.Domain;
using Microsoft.AspNetCore.Mvc;

namespace Organograma.Api.Controllers;

[ApiController]
[Route("api/audit")]
[AuthGuard]
public sealed class AuditController(IAuditService auditService) : ControllerBase
{
    [HttpGet]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public async Task<IActionResult> List(
        [FromQuery] string? limit,
        [FromQuery] string? skip,
        CancellationToken ct)
    {
        var parsedLimit = int.TryParse(limit, out var l) && l > 0 ? l : 50;
        var parsedSkip = int.TryParse(skip, out var s) && s >= 0 ? s : 0;
        var user = HttpContext.GetAuthUser();
        var isSuperadmin = user?.Role == Roles.Superadmin;

        var result = await auditService.ListAsync(
            HttpContext.GetTenantId(),
            parsedLimit,
            parsedSkip,
            isSuperadmin,
            ct);

        return Ok(new
        {
            items = result.Items,
            total = result.Total,
            limit = result.Limit,
            skip = result.Skip,
        });
    }
}
