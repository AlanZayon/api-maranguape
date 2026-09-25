using Organograma.Application.Options;
using Organograma.Domain.Entities;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Organograma.Infrastructure.Persistence;

public sealed class MongoDbContext
{
    public const string TenantsCollection = "tenants";
    public const string UsersCollection = "users";
    public const string SetorsCollection = "setors";
    public const string CargosComissionadosCollection = "cargocomissionados";
    public const string SimbologiasCollection = "simbologias";
    public const string FuncionariosCollection = "funcionarios";
    public const string ReferencesCollection = "references";
    public const string BulkJobsCollection = "bulk_job_status";
    public const string AuditLogsCollection = "auditlogs";

    public IMongoDatabase Database { get; }
    public IMongoCollection<Tenant> Tenants { get; }
    public IMongoCollection<User> Users { get; }
    public IMongoCollection<Setor> Setors { get; }
    public IMongoCollection<CargoComissionado> CargosComissionados { get; }
    public IMongoCollection<LimiteSimbologia> Simbologias { get; }
    public IMongoCollection<Funcionario> Funcionarios { get; }
    public IMongoCollection<Reference> References { get; }
    public IMongoCollection<BsonDocument> BulkJobs { get; }
    public IMongoCollection<AuditLog> AuditLogs { get; }

    public MongoDbContext(IOptions<MongoOptions> options)
    {
        var settings = MongoClientSettings.FromConnectionString(options.Value.ConnectionString);
        var client = new MongoClient(settings);
        Database = client.GetDatabase(options.Value.DatabaseName);
        Tenants = Database.GetCollection<Tenant>(TenantsCollection);
        Users = Database.GetCollection<User>(UsersCollection);
        Setors = Database.GetCollection<Setor>(SetorsCollection);
        CargosComissionados = Database.GetCollection<CargoComissionado>(CargosComissionadosCollection);
        Simbologias = Database.GetCollection<LimiteSimbologia>(SimbologiasCollection);
        Funcionarios = Database.GetCollection<Funcionario>(FuncionariosCollection);
        References = Database.GetCollection<Reference>(ReferencesCollection);
        BulkJobs = Database.GetCollection<BsonDocument>(BulkJobsCollection);
        AuditLogs = Database.GetCollection<AuditLog>(AuditLogsCollection);
    }
}
