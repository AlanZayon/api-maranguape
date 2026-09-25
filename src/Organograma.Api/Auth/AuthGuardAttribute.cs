using System.Security.Claims;
using System.Text;
using Organograma.Application.Options;
using Organograma.Domain;
using Organograma.Domain.Entities;
using Organograma.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using MongoDB.Driver;

namespace Organograma.Api.Auth;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AuthGuardAttribute : Attribute, IAsyncAuthorizationFilter, IOrderedFilter
{
    public int Order => -100;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var http = context.HttpContext;
        var config = http.RequestServices.GetRequiredService<IOptions<JwtOptions>>().Value;
        var db = http.RequestServices.GetRequiredService<MongoDbContext>();

        if (!http.Request.Cookies.TryGetValue("authToken", out var token) || string.IsNullOrEmpty(token))
        {
            context.Result = Error(401, "UNAUTHORIZED", "Não autenticado");
            return;
        }

        try
        {
            var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.Secret)),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30),
            }, out _);

            var id = principal.FindFirst("id")?.Value ?? "";
            var role = principal.FindFirst("role")?.Value ?? "";
            var username = principal.FindFirst("username")?.Value ?? "";
            var tenantId = principal.FindFirst("tenantId")?.Value;
            if (string.IsNullOrEmpty(tenantId)) tenantId = null;

            var user = new AuthUser(id, role, username, tenantId);
            http.Items[HttpContextKeys.User] = user;

            var isSuperadmin = role == Roles.Superadmin;
            if (!isSuperadmin && string.IsNullOrEmpty(tenantId))
            {
                context.Result = Error(403, "TENANT_REQUIRED", "Usuário sem tenant associado");
                return;
            }

            if (!string.IsNullOrEmpty(tenantId) && http.Items[HttpContextKeys.TenantId] is null)
                http.Items[HttpContextKeys.TenantId] = tenantId;

            if (isSuperadmin)
            {
                string? actAs = null;
                if (http.Request.Headers.TryGetValue("X-Act-As-Tenant", out var headerAct))
                    actAs = headerAct.ToString();
                else if (http.Request.Query.TryGetValue("actAs", out var queryAct))
                    actAs = queryAct.ToString();

                if (!string.IsNullOrWhiteSpace(actAs))
                {
                    var slug = actAs.ToLowerInvariant().Trim();
                    var tenant = await db.Tenants
                        .Find(t => t.Slug == slug && t.Status == "active")
                        .FirstOrDefaultAsync(http.RequestAborted);

                    if (tenant is null)
                    {
                        context.Result = Error(404, "ACT_AS_TENANT_NOT_FOUND", "Tenant para impersonação não encontrado");
                        return;
                    }

                    http.Items[HttpContextKeys.Tenant] = tenant;
                    http.Items[HttpContextKeys.TenantId] = tenant.Id.ToString();
                    http.Items[HttpContextKeys.ActingAsTenant] = true;
                }
            }
        }
        catch (AppException app)
        {
            context.Result = Error(app.StatusCode, app.Code, app.Message);
        }
        catch
        {
            context.Result = Error(401, "UNAUTHORIZED", "Sessão inválida ou expirada");
        }
    }

    private static JsonResult Error(int status, string code, string message) => new(new
    {
        error = true,
        code,
        message,
    })
    {
        StatusCode = status,
    };
}

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RolesAttribute : Attribute, IAuthorizationFilter
{
    private readonly string[] _roles;

    public RolesAttribute(params string[] roles) => _roles = roles;

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        if (_roles.Length == 0) return;

        var user = context.HttpContext.Items[HttpContextKeys.User] as AuthUser;
        if (user is null)
        {
            context.Result = new JsonResult(new { error = true, code = "UNAUTHORIZED", message = "Não autenticado" })
            {
                StatusCode = 401,
            };
            return;
        }

        if (!_roles.Contains(user.Role))
        {
            context.Result = new JsonResult(new { error = true, code = "FORBIDDEN", message = "Acesso negado" })
            {
                StatusCode = 403,
            };
        }
    }
}

public static class HttpContextKeys
{
    public const string User = "AuthUser";
    public const string TenantId = "TenantId";
    public const string Tenant = "Tenant";
    public const string ActingAsTenant = "ActingAsTenant";
}

public static class HttpContextAuthExtensions
{
    public static AuthUser? GetAuthUser(this HttpContext http)
        => http.Items[HttpContextKeys.User] as AuthUser;

    public static string? GetTenantId(this HttpContext http)
        => http.Items[HttpContextKeys.TenantId] as string;

    public static Tenant? GetTenant(this HttpContext http)
        => http.Items[HttpContextKeys.Tenant] as Tenant;
}
