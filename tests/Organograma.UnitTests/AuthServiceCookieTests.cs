using Organograma.Application.Abstractions;
using Organograma.Application.Auth;
using Organograma.Application.Options;
using Organograma.Domain.Entities;
using Microsoft.Extensions.Options;

namespace Organograma.UnitTests;

public class AuthServiceCookieTests
{
    [Theory]
    [InlineData("24h", 24 * 3_600_000)]
    [InlineData("1h", 3_600_000)]
    [InlineData("30m", 30 * 60_000)]
    [InlineData("45s", 45_000)]
    [InlineData("2d", 2 * 86_400_000)]
    [InlineData("90", 90_000)]
    [InlineData("", 24 * 3_600_000)]
    [InlineData("bogus", 24 * 3_600_000)]
    public void GetCookieMaxAgeMs_parses_expires_in(string expiresIn, int expectedMs)
    {
        var service = CreateService(expiresIn);
        Assert.Equal(expectedMs, service.GetCookieMaxAgeMs());
    }

    private static AuthService CreateService(string expiresIn)
    {
        var options = Options.Create(new JwtOptions
        {
            Secret = "unit_test_jwt_secret_at_least_32_chars!!",
            ExpiresIn = expiresIn,
        });
        return new AuthService(options, new StubAuthRepository());
    }

    private sealed class StubAuthRepository : IAuthRepository
    {
        public Task<User?> FindUserByLoginIdAsync(string loginId, CancellationToken ct = default)
            => Task.FromResult<User?>(null);

        public Task<User?> FindUserForLoginAsync(string loginId, string? tenantId, CancellationToken ct = default)
            => Task.FromResult<User?>(null);

        public Task<User?> FindUserByMongoIdAsync(string id, CancellationToken ct = default)
            => Task.FromResult<User?>(null);

        public Task UpdateUserTokenAsync(string userId, string token, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task InvalidateUserTokenAsync(string userId, CancellationToken ct = default)
            => Task.CompletedTask;
    }
}
