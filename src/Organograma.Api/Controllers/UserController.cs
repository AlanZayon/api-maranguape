using Organograma.Api.Auth;
using Organograma.Application.Users;
using Organograma.Domain;
using Microsoft.AspNetCore.Mvc;

namespace Organograma.Api.Controllers;

[ApiController]
[Route("api/usuarios/manage")]
[AuthGuard]
[Roles(Roles.Owner, Roles.Superadmin)]
public sealed class UserController(UserService userService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var user = HttpContext.GetAuthUser()!;
        var users = await userService.ListAsync(user, ct);
        return Ok(new { users });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserInput body, CancellationToken ct)
    {
        var user = HttpContext.GetAuthUser()!;
        var created = await userService.CreateAsync(user, body, ct);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateUserInput body, CancellationToken ct)
    {
        var user = HttpContext.GetAuthUser()!;
        var updated = await userService.UpdateAsync(user, id, body, ct);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Remove(string id, CancellationToken ct)
    {
        var user = HttpContext.GetAuthUser()!;
        var result = await userService.RemoveAsync(user, id, ct);
        return Ok(result);
    }
}
