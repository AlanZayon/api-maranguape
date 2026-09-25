using Organograma.Domain;

namespace Organograma.UnitTests;

public class RolesTests
{
    [Fact]
    public void Role_constants_match_expected_values()
    {
        Assert.Equal("owner", Roles.Owner);
        Assert.Equal("admin", Roles.Admin);
        Assert.Equal("user", Roles.User);
        Assert.Equal("readonly", Roles.Readonly);
        Assert.Equal("superadmin", Roles.Superadmin);
    }

    [Fact]
    public void TenantElevated_includes_owner_admin_superadmin()
    {
        Assert.Equal([Roles.Owner, Roles.Admin, Roles.Superadmin], Roles.TenantElevated);
        Assert.DoesNotContain(Roles.User, Roles.TenantElevated);
    }

    [Fact]
    public void TenantStaff_includes_owner_admin_user()
    {
        Assert.Equal([Roles.Owner, Roles.Admin, Roles.User], Roles.TenantStaff);
        Assert.DoesNotContain(Roles.Readonly, Roles.TenantStaff);
        Assert.DoesNotContain(Roles.Superadmin, Roles.TenantStaff);
    }

    [Fact]
    public void UsersManagers_includes_owner_and_superadmin()
    {
        Assert.Equal([Roles.Owner, Roles.Superadmin], Roles.UsersManagers);
        Assert.DoesNotContain(Roles.Admin, Roles.UsersManagers);
    }
}
