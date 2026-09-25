using Organograma.Api.Auth;
using Organograma.Application.Dashboard;
using Organograma.Domain;
using Microsoft.AspNetCore.Mvc;

namespace Organograma.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[AuthGuard]
[Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
public sealed class DashboardController(DashboardService dashboardService) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
        => Ok(await dashboardService.GetSummaryAsync(HttpContext.GetTenantId(), ct));

    [HttpGet("contratos")]
    public async Task<IActionResult> Contratos(
        [FromQuery] string? within,
        [FromQuery] string? limit,
        CancellationToken ct)
    {
        var withinDays = int.TryParse(within, out var w) && w > 0 ? w : 90;
        var parsedLimit = int.TryParse(limit, out var l) && l > 0 ? l : 20;
        var items = await dashboardService.GetContratosAsync(
            HttpContext.GetTenantId(),
            Math.Min(Math.Max(withinDays, 1), 365),
            Math.Min(Math.Max(parsedLimit, 1), 100),
            ct);
        return Ok(new { items });
    }

    [HttpGet("payroll")]
    public async Task<IActionResult> Payroll(CancellationToken ct)
        => Ok(await dashboardService.GetPayrollAsync(HttpContext.GetTenantId(), ct));
}
