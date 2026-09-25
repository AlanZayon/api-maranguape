using Organograma.Api.Auth;
using Organograma.Application.Referencias;
using Organograma.Domain;
using Microsoft.AspNetCore.Mvc;

namespace Organograma.Api.Controllers;

[ApiController]
[Route("api/referencias")]
[AuthGuard]
public sealed class ReferenciasController(ReferenciasService referenciasService) : ControllerBase
{
    [HttpPost("register-reference")]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public async Task<IActionResult> RegisterReference(
        [FromBody] RegisterReferenceDto body,
        CancellationToken ct)
    {
        var result = await referenciasService.RegisterReferenceAsync(
            body,
            HttpContext.GetTenantId(),
            HttpContext.GetAuthUser()?.Id,
            ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpGet("referencias-dados")]
    public async Task<IActionResult> GetReferences(CancellationToken ct)
    {
        var referencias = await referenciasService.GetReferencesAsync(HttpContext.GetTenantId(), ct);
        return Ok(new { referencias });
    }

    [HttpGet("arvore")]
    public async Task<IActionResult> GetTree(CancellationToken ct)
    {
        var arvore = await referenciasService.GetTreeAsync(HttpContext.GetTenantId(), ct);
        return Ok(new { arvore });
    }

    [HttpGet("funcionario/{funcionarioId}/cadeia")]
    public async Task<IActionResult> GetFuncionarioChain(string funcionarioId, CancellationToken ct)
        => Ok(await referenciasService.GetFuncionarioChainAsync(
            funcionarioId, HttpContext.GetTenantId(), ct));

    [HttpGet("{id}/ancestrais")]
    public async Task<IActionResult> GetAncestors(string id, CancellationToken ct)
        => Ok(await referenciasService.GetAncestorsAsync(id, HttpContext.GetTenantId(), ct));

    [HttpGet("{id}/descendentes")]
    public async Task<IActionResult> GetDescendants(string id, CancellationToken ct)
        => Ok(await referenciasService.GetDescendantsAsync(id, HttpContext.GetTenantId(), ct));

    [HttpGet("{id}/impacto-exclusao")]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public async Task<IActionResult> GetDeletionImpact(string id, CancellationToken ct)
        => Ok(await referenciasService.GetDeletionImpactAsync(id, HttpContext.GetTenantId(), ct));

    [HttpPatch("{id}")]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public async Task<IActionResult> UpdateReference(
        string id,
        [FromBody] UpdateReferenceDto body,
        CancellationToken ct)
    {
        var referencia = await referenciasService.UpdateReferenceAsync(
            id,
            body,
            HttpContext.GetTenantId(),
            HttpContext.GetAuthUser()?.Id,
            ct);
        return Ok(new
        {
            message = "Referência atualizada com sucesso!",
            referencia,
        });
    }

    [HttpDelete("delete-referencia/{id}")]
    [Roles(Roles.Owner, Roles.Admin, Roles.Superadmin)]
    public async Task<IActionResult> DeleteReference(string id, CancellationToken ct)
    {
        await referenciasService.DeleteReferenceAsync(id, HttpContext.GetTenantId(), ct);
        return Ok(new { message = "Referência deletada com sucesso!" });
    }
}
