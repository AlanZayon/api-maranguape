using Organograma.Api.Auth;
using Organograma.Application.CargosComissionados;
using Organograma.Domain;
using Microsoft.AspNetCore.Mvc;

namespace Organograma.Api.Controllers;

[ApiController]
[Route("api/cargos-comissionados")]
[AuthGuard]
public sealed class CargosComissionadosController(
    CargosComissionadosService cargosComissionadosService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Listar(CancellationToken ct)
        => Ok(await cargosComissionadosService.ListarCargosAsync(HttpContext.GetTenantId(), ct));

    [HttpGet("template")]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public IActionResult Template()
    {
        var buffer = cargosComissionadosService.GerarTemplateBuffer();
        return File(
            buffer,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "modelo-cargos-comissionados.xlsx");
    }

    [HttpPost("import")]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> Importar(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new AppException("Envie um arquivo .xlsx no campo file.", 400, "VALIDATION_ERROR");

        var name = (file.FileName ?? "").ToLowerInvariant();
        var contentType = file.ContentType ?? "";
        if (!name.EndsWith(".xlsx")
            && contentType != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            && contentType != "application/octet-stream")
        {
            throw new AppException("Apenas arquivos .xlsx são permitidos.", 400, "VALIDATION_ERROR");
        }

        await using var stream = file.OpenReadStream();
        return Ok(await cargosComissionadosService.ImportarPlanilhaAsync(
            stream,
            new CargoAuditContext
            {
                TenantId = HttpContext.GetTenantId(),
                UserId = HttpContext.GetAuthUser()?.Id,
            },
            ct));
    }

    [HttpPost]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public async Task<IActionResult> Criar([FromBody] CreateCargoComissionadoDto body, CancellationToken ct)
        => Ok(await cargosComissionadosService.CriarAsync(
            body,
            new CargoAuditContext
            {
                TenantId = HttpContext.GetTenantId(),
                UserId = HttpContext.GetAuthUser()?.Id,
            },
            ct));

    [HttpPut("{id}")]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public async Task<IActionResult> Atualizar(
        string id,
        [FromBody] CreateCargoComissionadoDto body,
        CancellationToken ct)
        => Ok(await cargosComissionadosService.AtualizarAsync(
            id,
            body,
            new CargoAuditContext
            {
                TenantId = HttpContext.GetTenantId(),
                UserId = HttpContext.GetAuthUser()?.Id,
            },
            ct));

    [HttpDelete("{id}")]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public async Task<IActionResult> Remover(string id, CancellationToken ct)
        => Ok(await cargosComissionadosService.RemoverAsync(
            id,
            new CargoAuditContext { TenantId = HttpContext.GetTenantId() },
            ct));
}
