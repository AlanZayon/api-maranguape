namespace Organograma.Domain;

public static class Roles
{
    public const string Owner = "owner";
    public const string Admin = "admin";
    public const string User = "user";
    public const string Readonly = "readonly";
    public const string Superadmin = "superadmin";

    public static readonly string[] TenantElevated = [Owner, Admin, Superadmin];
    public static readonly string[] TenantStaff = [Owner, Admin, User];
    public static readonly string[] UsersManagers = [Owner, Superadmin];
}

public sealed record AuthUser(
    string Id,
    string Role,
    string Username,
    string? TenantId);
