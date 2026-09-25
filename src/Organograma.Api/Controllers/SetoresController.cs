using Organograma.Api.Auth;
using Organograma.Application.Setores;
using Organograma.Domain;
using Microsoft.AspNetCore.Mvc;

namespace Organograma.Api.Controllers;

[ApiController]
[Route("api/setores")]
[AuthGuard]
public sealed class SetoresController(SetoresService setoresService) : ControllerBase
{
    [HttpPost]
    [Roles(Roles.Owner, Roles.Admin, Roles.User)]
    public async Task<IActionResult> CreateSetor([FromBody] CreateSetorDto body, CancellationToken ct)
    {
        var result = await setoresService.CreateSetorAsync(
            body,
            HttpContext.GetTenantId(),
            HttpContext.GetAuthUser()?.Id,
            ct);
        return Ok(result);
    }

    [HttpGet("setoresOrganizados")]
    public async Task<IActionResult> GetSetoresOrganizados(CancellationToken ct)
    {
        var setores = await setoresService.GetSetoresOrganizadosAsync(HttpContext.GetTenantId(), ct);
        return Ok(new { setores });
    }

    [HttpGet("setoresMain")]
    public async Task<IActionResult> GetMainSetores(CancellationToken ct)
    {
        var setores = await setoresService.GetMainSetoresAsync(HttpContext.GetTenantId(), ct);
        return Ok(new { setores });
    }

    [HttpGet("roots")]
    public async Task<IActionResult> GetRoots(CancellationToken ct)
    {
        var children = await setoresService.GetChildrenAsync(null, HttpContext.GetTenantId(), ct);
        return Ok(new { children });
    }

    [HttpGet("dados/{setorId}")]
    public async Task<IActionResult> GetSetorData(string setorId, CancellationToken ct)
        => Ok(await setoresService.GetSetorDataAsync(setorId, HttpContext.GetTenantId(), ct));

    [HttpGet("{id}/children")]
    public async Task<IActionResult> GetChildren(string id, CancellationToken ct)
    {
        var children = await setoresService.GetChildrenAsync(id, HttpContext.GetTenantId(), ct);
        return Ok(new { children });
    }

    [HttpPut("rename/{id}")]
    [Roles(Roles.Owner, Roles.Admin, Roles.User)]
    public async Task<IActionResult> RenameSetor(string id, [FromBody] RenameSetorDto body, CancellationToken ct)
        => Ok(await setoresService.RenameSetorAsync(
            id,
            body.Nome,
            HttpContext.GetAuthUser()?.Id,
            HttpContext.GetTenantId(),
            ct));

    [HttpPut("{id}/parent")]
    [Roles(Roles.Owner, Roles.Admin, Roles.User)]
    public async Task<IActionResult> MoveSetor(string id, [FromBody] MoveSetorDto body, CancellationToken ct)
        => Ok(await setoresService.MoveSetorAsync(
            id,
            body.Parent,
            new MoveAuditContext
            {
                TenantId = HttpContext.GetTenantId(),
                UserId = HttpContext.GetAuthUser()?.Id,
            },
            ct));

    [HttpDelete("del/{id}")]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public async Task<IActionResult> DeleteSetor(string id, CancellationToken ct)
    {
        await setoresService.DeleteSetorAsync(
            id,
            new MoveAuditContext
            {
                TenantId = HttpContext.GetTenantId(),
                UserId = HttpContext.GetAuthUser()?.Id,
            },
            ct);
        return Ok(new { message = "Setor e seus filhos deletados com sucesso" });
    }
}
