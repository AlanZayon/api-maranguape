using Organograma.Application.Abstractions;

namespace Organograma.Infrastructure.Audit;

/// <summary>Stub audit logger — full audit module will be ported later.</summary>
public sealed class NullAuditService : IAuditService
{
    public Task LogActionAsync(
        string? tenantId,
        string? userId,
        string action,
        string entity,
        object? entityId,
        object? meta = null,
        CancellationToken ct = default)
        => Task.CompletedTask;

    public Task<AuditListResult> ListAsync(
        string? tenantId,
        int limit = 50,
        int skip = 0,
        bool isSuperadmin = false,
        CancellationToken ct = default)
        => Task.FromResult(new AuditListResult
        {
            Items = [],
            Total = 0,
            Limit = limit,
            Skip = skip,
        });
}
