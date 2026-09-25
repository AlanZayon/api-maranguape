using Organograma.Application.Abstractions;
using Organograma.Domain;
using Organograma.Domain.Entities;
using Organograma.Infrastructure.Persistence;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Persistence;

public sealed class AuthRepository(MongoDbContext db) : IAuthRepository
{
    public Task<User?> FindUserByLoginIdAsync(string loginId, CancellationToken ct = default)
        => db.Users.Find(u => u.LoginId == loginId).FirstOrDefaultAsync(ct)!;

    public async Task<User?> FindUserForLoginAsync(string loginId, string? tenantId, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(loginId)) return null;

        var byId = await db.Users.Find(u => u.LoginId == loginId).FirstOrDefaultAsync(ct);
        if (byId is not null) return byId;

        if (tenantId is not null)
        {
            var filter = Builders<User>.Filter.Eq(u => u.Username, loginId)
                         & new BsonDocumentFilterDefinition<User>(TenantHelpers.TenantFilter(tenantId));
            var scoped = await db.Users.Find(filter).FirstOrDefaultAsync(ct);
            if (scoped is not null) return scoped;
        }

        var byUsername = await db.Users.Find(u => u.Username == loginId).Limit(2).ToListAsync(ct);
        if (byUsername.Count == 1) return byUsername[0];
        if (tenantId is not null)
            return byUsername.FirstOrDefault(u => u.TenantId?.ToString() == tenantId);
        return byUsername.FirstOrDefault(u => u.Role == Roles.Superadmin);
    }

    public Task<User?> FindUserByMongoIdAsync(string id, CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return Task.FromResult<User?>(null);
        return db.Users.Find(u => u.Id == oid).FirstOrDefaultAsync(ct)!;
    }

    public Task UpdateUserTokenAsync(string userId, string token, CancellationToken ct = default)
    {
        var oid = ObjectId.Parse(userId);
        return db.Users.UpdateOneAsync(
            u => u.Id == oid,
            Builders<User>.Update
                .Set(u => u.LastValidToken, token)
                .Set(u => u.TokenExpiresAt, DateTime.UtcNow.AddHours(24))
                .Set(u => u.UpdatedAt, DateTime.UtcNow),
            cancellationToken: ct);
    }

    public Task InvalidateUserTokenAsync(string userId, CancellationToken ct = default)
    {
        var oid = ObjectId.Parse(userId);
        return db.Users.UpdateOneAsync(
            u => u.Id == oid,
            Builders<User>.Update
                .Set(u => u.LastValidToken, (string?)null)
                .Set(u => u.UpdatedAt, DateTime.UtcNow),
            cancellationToken: ct);
    }
}

public sealed class UserRepository(MongoDbContext db) : IUserRepository
{
    public async Task<IReadOnlyList<User>> FindAsync(BsonFilter filter, CancellationToken ct = default)
    {
        var cursor = await db.Users
            .Find(new BsonDocumentFilterDefinition<User>(filter.Document))
            .SortByDescending(u => u.CreatedAt)
            .ToListAsync(ct);
        return cursor;
    }

    public Task<User?> FindOneAsync(BsonFilter filter, CancellationToken ct = default)
        => db.Users.Find(new BsonDocumentFilterDefinition<User>(filter.Document)).FirstOrDefaultAsync(ct)!;

    public async Task<User> CreateAsync(User user, CancellationToken ct = default)
    {
        if (user.Id == ObjectId.Empty) user.Id = ObjectId.GenerateNewId();
        await db.Users.InsertOneAsync(user, cancellationToken: ct);
        return user;
    }

    public async Task<User> UpdateAsync(User user, CancellationToken ct = default)
    {
        await db.Users.ReplaceOneAsync(u => u.Id == user.Id, user, cancellationToken: ct);
        return user;
    }

    public Task DeleteAsync(User user, CancellationToken ct = default)
        => db.Users.DeleteOneAsync(u => u.Id == user.Id, ct);

    public Task<long> CountOwnersAsync(ObjectId? tenantId, ObjectId excludeId, CancellationToken ct = default)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Role, Roles.Owner)
                     & Builders<User>.Filter.Ne(u => u.Id, excludeId)
                     & Builders<User>.Filter.Eq(u => u.TenantId, tenantId);
        return db.Users.CountDocumentsAsync(filter, cancellationToken: ct);
    }
}

public sealed class TenantsRepository(MongoDbContext db) : ITenantsRepository
{
    public Task<Tenant?> FindByIdAsync(string id, CancellationToken ct = default)
    {
        if (!ObjectId.TryParse(id, out var oid)) return Task.FromResult<Tenant?>(null);
        return db.Tenants.Find(t => t.Id == oid).FirstOrDefaultAsync(ct)!;
    }

    public Task<Tenant?> FindBySlugAsync(string slug, bool activeOnly = true, CancellationToken ct = default)
    {
        var filter = Builders<Tenant>.Filter.Eq(t => t.Slug, slug.ToLowerInvariant().Trim());
        if (activeOnly)
            filter &= Builders<Tenant>.Filter.Eq(t => t.Status, "active");
        return db.Tenants.Find(filter).FirstOrDefaultAsync(ct)!;
    }

    public async Task<IReadOnlyList<Tenant>> ListAsync(CancellationToken ct = default)
        => await db.Tenants.Find(FilterDefinition<Tenant>.Empty).SortBy(t => t.Name).ToListAsync(ct);

    public async Task<Tenant> CreateAsync(Tenant tenant, CancellationToken ct = default)
    {
        if (tenant.Id == ObjectId.Empty) tenant.Id = ObjectId.GenerateNewId();
        await db.Tenants.InsertOneAsync(tenant, cancellationToken: ct);
        return tenant;
    }

    public async Task<Tenant> UpdateAsync(Tenant tenant, CancellationToken ct = default)
    {
        await db.Tenants.ReplaceOneAsync(t => t.Id == tenant.Id, tenant, cancellationToken: ct);
        return tenant;
    }
}
