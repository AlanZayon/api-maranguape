using Organograma.Application.Auth;
using Organograma.Api.Auth;
using Microsoft.AspNetCore.Mvc;

namespace Organograma.Api.Controllers;

[ApiController]
[Route("api/usuarios")]
public sealed class AuthController(AuthService authService) : ControllerBase
{
    public sealed class LoginBody
    {
        public string? Id { get; set; }
        public string? Password { get; set; }
    }

    private static CookieOptions AuthCookieOptions()
    {
        // Match Nest: NODE_ENV === 'production' → Secure + SameSite=None; else Lax
        var production = string.Equals(
            Environment.GetEnvironmentVariable("NODE_ENV"),
            "production",
            StringComparison.OrdinalIgnoreCase);

        return new CookieOptions
        {
            HttpOnly = true,
            Secure = production,
            SameSite = production ? SameSiteMode.None : SameSiteMode.Lax,
            Path = "/",
        };
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginBody? body, CancellationToken ct)
    {
        var tokenLogin = Request.Cookies["authToken"];
        var tenantId = HttpContext.GetTenantId();

        var result = await authService.LoginAsync(
            body?.Id,
            body?.Password,
            tokenLogin,
            tenantId,
            ct);

        var cookie = AuthCookieOptions();
        cookie.MaxAge = TimeSpan.FromMilliseconds(authService.GetCookieMaxAgeMs());
        Response.Cookies.Append("authToken", result.Token, cookie);

        return Ok(new
        {
            authenticated = result.User.Authenticated,
            username = result.User.Username,
            role = result.User.Role,
            tenantId = result.User.TenantId,
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var token = Request.Cookies["authToken"];
        await authService.LogoutAsync(token, ct);
        Response.Cookies.Delete("authToken", AuthCookieOptions());
        return Ok(new { message = "Logout realizado com sucesso!" });
    }

    [HttpGet("verify")]
    public IActionResult Verify()
    {
        var token = Request.Cookies["authToken"];
        var result = authService.VerifyToken(token);
        var authenticated = result.GetType().GetProperty("authenticated")?.GetValue(result) as bool? ?? false;
        return StatusCode(authenticated ? 200 : 401, result);
    }
}
