using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Organograma.Application.Abstractions;
using Organograma.Application.Options;
using Organograma.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Organograma.Application.Auth;

public sealed record LoginResult(
    string Token,
    LoginUserResult User);

public sealed record LoginUserResult(
    bool Authenticated,
    string Username,
    string Role,
    string? TenantId);

public abstract record VerifyResult
{
    public sealed record Authenticated(
        bool IsAuthenticated,
        string Username,
        string Role,
        string? TenantId,
        string Id) : VerifyResult;

    public sealed record Unauthenticated(bool IsAuthenticated = false) : VerifyResult;
}

public sealed class AuthService(
    IOptions<JwtOptions> jwtOptions,
    IAuthRepository authRepository)
{
    private readonly JwtOptions _jwt = jwtOptions.Value;

    public int GetCookieMaxAgeMs() => ParseExpiresToMs(_jwt.ExpiresIn);

    public async Task<LoginResult> LoginAsync(
        string? id,
        string? password,
        string? tokenLogin,
        string? tenantId,
        CancellationToken ct = default)
    {
        _ = tokenLogin;

        var user = await authRepository.FindUserForLoginAsync(id ?? "", tenantId, ct);
        if (user is null)
            throw new AppException("Credenciais incorretas", 401, "INVALID_CREDENTIALS");

        if (user.Role != Roles.Superadmin && user.TenantId is null)
            throw new AppException("Usuário sem tenant associado", 403, "TENANT_REQUIRED");

        if (tenantId is not null
            && user.Role != Roles.Superadmin
            && user.TenantId?.ToString() != tenantId)
        {
            throw new AppException("Credenciais incorretas", 401, "INVALID_CREDENTIALS");
        }

        if (string.IsNullOrEmpty(password) || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            throw new AppException("Credenciais incorretas", 401, "INVALID_CREDENTIALS");

        var tenantIdStr = user.TenantId?.ToString();
        var payloadId = user.Id.ToString();
        var token = CreateToken(payloadId, user.Role, user.Username, tenantIdStr);

        await authRepository.UpdateUserTokenAsync(payloadId, token, ct);

        return new LoginResult(
            token,
            new LoginUserResult(true, user.Username, user.Role, tenantIdStr));
    }

    public async Task LogoutAsync(string? token, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(token)) return;

        string? userId = null;
        try
        {
            var principal = ValidateToken(token);
            userId = principal.FindFirst("id")?.Value
                     ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        }
        catch (SecurityTokenExpiredException)
        {
            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(token);
            userId = jwt.Claims.FirstOrDefault(c => c.Type == "id")?.Value;
        }

        if (!string.IsNullOrEmpty(userId))
            await authRepository.InvalidateUserTokenAsync(userId, ct);
    }

    public object VerifyToken(string? token)
    {
        if (string.IsNullOrEmpty(token))
            return new { authenticated = false };

        try
        {
            var principal = ValidateToken(token);
            var id = principal.FindFirst("id")?.Value ?? "";
            var username = principal.FindFirst("username")?.Value ?? "";
            var role = principal.FindFirst("role")?.Value ?? "";
            var tenantId = principal.FindFirst("tenantId")?.Value;
            if (string.IsNullOrEmpty(tenantId)) tenantId = null;

            return new
            {
                authenticated = true,
                username,
                role,
                tenantId,
                id,
            };
        }
        catch
        {
            return new { authenticated = false };
        }
    }

    public ClaimsPrincipal ValidateToken(string token)
    {
        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
        return handler.ValidateToken(token, parameters, out _);
    }

    private string CreateToken(string id, string role, string username, string? tenantId)
    {
        var claims = new List<Claim>
        {
            new("id", id),
            new("role", role),
            new("username", username),
        };
        if (tenantId is not null)
            claims.Add(new Claim("tenantId", tenantId));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMilliseconds(ParseExpiresToMs(_jwt.ExpiresIn));

        var token = new JwtSecurityToken(
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static int ParseExpiresToMs(string? expiresIn)
    {
        if (string.IsNullOrWhiteSpace(expiresIn)) return 24 * 60 * 60 * 1000;
        if (int.TryParse(expiresIn, out var secondsOnly)) return secondsOnly * 1000;

        var match = System.Text.RegularExpressions.Regex.Match(expiresIn, @"^(\d+)([smhd])$");
        if (!match.Success) return 24 * 60 * 60 * 1000;
        var n = int.Parse(match.Groups[1].Value);
        return match.Groups[2].Value switch
        {
            "s" => n * 1000,
            "m" => n * 60_000,
            "h" => n * 3_600_000,
            "d" => n * 86_400_000,
            _ => n * 3_600_000,
        };
    }
}
