using Organograma.Domain;
using Organograma.Domain.Entities;
using Microsoft.Extensions.Configuration;
using MongoDB.Driver;

var config = new ConfigurationBuilder()
    .AddEnvironmentVariables()
    .Build();

var mongoUri = Environment.GetEnvironmentVariable("MONGO_CONNECTING_FUNCIONARIOS")
               ?? config["MONGO_CONNECTING_FUNCIONARIOS"]
               ?? "mongodb://localhost:27017/funcionarios";

var loginId = Environment.GetEnvironmentVariable("SUPERADMIN_ID") ?? "superadmin";
var username = Environment.GetEnvironmentVariable("SUPERADMIN_USERNAME") ?? "superadmin";
var password = Environment.GetEnvironmentVariable("SUPERADMIN_PASSWORD") ?? "change_me";

var url = new MongoUrl(mongoUri);
var client = new MongoClient(url);
var db = client.GetDatabase(url.DatabaseName ?? "funcionarios");
var users = db.GetCollection<User>("users");

var existing = await users.Find(u => u.LoginId == loginId || u.Role == Roles.Superadmin)
    .FirstOrDefaultAsync();

var now = DateTime.UtcNow;
var hash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 10);

if (existing is null)
{
    await users.InsertOneAsync(new User
    {
        LoginId = loginId,
        Username = username,
        PasswordHash = hash,
        Role = Roles.Superadmin,
        TenantId = null,
        CreatedAt = now,
        UpdatedAt = now,
    });
    Console.WriteLine($"Created superadmin loginId={loginId} username={username}");
}
else
{
    var update = Builders<User>.Update
        .Set(u => u.Username, username)
        .Set(u => u.PasswordHash, hash)
        .Set(u => u.Role, Roles.Superadmin)
        .Set(u => u.UpdatedAt, now);
    await users.UpdateOneAsync(u => u.Id == existing.Id, update);
    Console.WriteLine($"Updated superadmin id={existing.Id} loginId={loginId}");
}
