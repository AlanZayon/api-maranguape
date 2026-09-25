using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using MongoDB.Bson;

namespace Organograma.Application.Users;

public sealed class CreateUserInput
{
    public string? Id { get; set; }
    public string? Username { get; set; }
    public string Password { get; set; } = "";
    public string? Role { get; set; }
    public string? TenantId { get; set; }
}

public sealed class UpdateUserInput
{
    public string? Username { get; set; }
    public string? Role { get; set; }
    public string? Password { get; set; }
    public string? TenantId { get; set; }
}

public sealed class UserService(
    IUserRepository userRepository,
    IAuditService auditService)
{
    private static readonly HashSet<string> TenantAssignableRoles = new(StringComparer.Ordinal)
    {
        Roles.Admin, Roles.User,
    };

    public BsonFilter BuildScopeFilter(AuthUser requester)
    {
        if (requester.Role == Roles.Superadmin)
            return BsonFilter.Empty;

        if (string.IsNullOrEmpty(requester.TenantId))
            throw new AppException("Usuário sem tenant associado", 403, "TENANT_REQUIRED");

        return BsonFilter.From(TenantHelpers.TenantFilter(requester.TenantId));
    }

    public void AssertAssignableRole(AuthUser requester, string role)
    {
        if (requester.Role == Roles.Superadmin) return;
        if (!TenantAssignableRoles.Contains(role))
            throw new AppException("Papel inválido. Use admin ou user", 400, "VALIDATION_ERROR");
    }

    public async Task<IReadOnlyList<object>> ListAsync(AuthUser requester, CancellationToken ct = default)
    {
        var filter = BuildScopeFilter(requester);
        var users = await userRepository.FindAsync(filter, ct);
        return users.Select(SanitizeUser).ToList();
    }

    public async Task<object> CreateAsync(AuthUser requester, CreateUserInput data, CancellationToken ct = default)
    {
        var username = data.Username ?? data.Id;
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(data.Password))
            throw new AppException("username (ou id) e password são obrigatórios", 400, "VALIDATION_ERROR");

        var role = data.Role ?? Roles.User;
        AssertAssignableRole(requester, role);

        string? resolvedTenantId = data.TenantId ?? requester.TenantId;

        if (requester.Role != Roles.Superadmin)
        {
            resolvedTenantId = requester.TenantId;
            if (role is Roles.Superadmin or Roles.Owner)
                throw new AppException("Não é permitido atribuir este papel", 403, "FORBIDDEN");
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(data.Password, workFactor: 10);
        var userId = string.IsNullOrWhiteSpace(data.Id) ? Guid.NewGuid().ToString() : data.Id;

        try
        {
            var now = DateTime.UtcNow;
            var user = new User
            {
                LoginId = userId,
                Username = username,
                PasswordHash = passwordHash,
                Role = role,
                TenantId = TenantHelpers.ToObjectId(resolvedTenantId),
                CreatedBy = TenantHelpers.ToObjectId(requester.Id),
                CreatedAt = now,
                UpdatedAt = now,
            };

            user = await userRepository.CreateAsync(user, ct);

            _ = auditService.LogActionAsync(
                resolvedTenantId,
                requester.Id,
                "CREATE",
                "user",
                user.Id,
                new { username, role },
                ct);

            return SanitizeUser(user);
        }
        catch (MongoDB.Driver.MongoWriteException ex) when (ex.WriteError?.Code == 11000)
        {
            throw new AppException("Usuário ou id já existente", 409, "CONFLICT");
        }
    }

    public async Task<object> UpdateAsync(
        AuthUser requester,
        string userMongoId,
        UpdateUserInput data,
        CancellationToken ct = default)
    {
        var filter = BsonFilter.From(new BsonDocument("_id", ObjectId.Parse(userMongoId)))
            .And(BuildScopeFilter(requester).Document);

        var user = await userRepository.FindOneAsync(filter, ct)
            ?? throw new AppException("Usuário não encontrado", 404, "NOT_FOUND");

        if (data.Role is not null)
        {
            AssertAssignableRole(requester, data.Role);

            if (requester.Role != Roles.Superadmin && data.Role == Roles.Superadmin)
                throw new AppException("Apenas superadmin pode promover a superadmin", 403, "FORBIDDEN");

            if (user.Role == Roles.Owner && data.Role != Roles.Owner)
            {
                var ownersLeft = await userRepository.CountOwnersAsync(user.TenantId, user.Id, ct);
                if (ownersLeft == 0)
                    throw new AppException("Não é possível remover o único dono do tenant", 400, "VALIDATION_ERROR");
            }
        }

        if (!string.IsNullOrEmpty(data.Username)) user.Username = data.Username;
        if (!string.IsNullOrEmpty(data.Role)) user.Role = data.Role;
        if (!string.IsNullOrEmpty(data.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(data.Password, workFactor: 10);
        if (requester.Role == Roles.Superadmin && data.TenantId is not null)
            user.TenantId = string.IsNullOrEmpty(data.TenantId) ? null : TenantHelpers.ToObjectId(data.TenantId);
        user.UpdatedBy = TenantHelpers.ToObjectId(requester.Id);
        user.UpdatedAt = DateTime.UtcNow;

        user = await userRepository.UpdateAsync(user, ct);
        return SanitizeUser(user);
    }

    public async Task<object> RemoveAsync(AuthUser requester, string userMongoId, CancellationToken ct = default)
    {
        var filter = BsonFilter.From(new BsonDocument("_id", ObjectId.Parse(userMongoId)))
            .And(BuildScopeFilter(requester).Document);

        var user = await userRepository.FindOneAsync(filter, ct)
            ?? throw new AppException("Usuário não encontrado", 404, "NOT_FOUND");

        if (user.Id.ToString() == requester.Id)
            throw new AppException("Não é possível excluir o próprio usuário", 400, "VALIDATION_ERROR");

        if (user.Role == Roles.Owner)
            throw new AppException("Não é possível excluir o dono do tenant", 400, "VALIDATION_ERROR");

        await userRepository.DeleteAsync(user, ct);

        _ = auditService.LogActionAsync(
            user.TenantId?.ToString(),
            requester.Id,
            "DELETE",
            "user",
            user.Id,
            new { username = user.Username },
            ct);

        return new { message = "Usuário removido com sucesso" };
    }

    private static object SanitizeUser(User user) => new
    {
        _id = user.Id.ToString(),
        id = user.LoginId,
        username = user.Username,
        role = user.Role,
        tenantId = user.TenantId?.ToString(),
        tokenExpiresAt = user.TokenExpiresAt,
        createdBy = user.CreatedBy?.ToString(),
        updatedBy = user.UpdatedBy?.ToString(),
        createdAt = user.CreatedAt,
        updatedAt = user.UpdatedAt,
    };
}
