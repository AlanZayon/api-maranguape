using Organograma.Api.Middleware;
using Microsoft.AspNetCore.Mvc;

namespace Organograma.Api.Controllers;

[ApiController]
public sealed class HealthController(MetricsCollector metrics) : ControllerBase
{
    [HttpGet("/")]
    public IActionResult Root()
        => Ok(new { status = "ok", service = "api-organograma" });

    [HttpGet("/health")]
    public IActionResult Health()
        => Ok(new { status = "healthy", uptime = Environment.TickCount64 / 1000.0 });

    [HttpGet("/metrics")]
    public IActionResult Metrics()
        => Ok(metrics.GetSnapshot());
}
