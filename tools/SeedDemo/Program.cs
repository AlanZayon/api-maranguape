using MongoDB.Bson;
using MongoDB.Driver;
using Organograma.Domain;
using Organograma.Domain.Entities;
using Organograma.Domain.Serialization;

LoadDotEnv(FindEnvFile());

var reset = args.Contains("--reset", StringComparer.OrdinalIgnoreCase)
            || IsTruthy(Env("SEED_DEMO_RESET"));

var mongoUri = Env("MONGO_CONNECTING_FUNCIONARIOS")
               ?? Env("MONGO_CONNECTING_USUARIOS")
               ?? "mongodb://localhost:27017/funcionarios";

var slug = Env("DEMO_TENANT_SLUG") ?? "demo";
var tenantName = Env("DEMO_TENANT_NAME") ?? "Prefeitura Demo";
var demoPassword = Env("DEMO_PASSWORD") ?? "Demo@2026";

var superLoginId = Env("SUPERADMIN_ID") ?? "superadmin";
var superUsername = Env("SUPERADMIN_USERNAME") ?? "superadmin";
var superPassword = Env("SUPERADMIN_PASSWORD") ?? "change_me";

var url = new MongoUrl(mongoUri);
var client = new MongoClient(url);
var db = client.GetDatabase(url.DatabaseName ?? "funcionarios");

var tenants = db.GetCollection<Tenant>("tenants");
var users = db.GetCollection<User>("users");
var setors = db.GetCollection<Setor>("setors");
var funcionarios = db.GetCollection<Funcionario>("funcionarios");
var references = db.GetCollection<Reference>("references");
var cargos = db.GetCollection<CargoComissionado>("cargocomissionados");
var simbologias = db.GetCollection<LimiteSimbologia>("simbologias");
var audit = db.GetCollection<AuditLog>("auditlogs");

var now = DateTime.UtcNow;
Console.WriteLine($"Mongo: {MaskUri(mongoUri)}");
Console.WriteLine($"Tenant slug: {slug} | reset={reset}");

// --- Superadmin (platform) ---
await UpsertUserAsync(
    users,
    loginId: superLoginId,
    username: superUsername,
    password: superPassword,
    role: Roles.Superadmin,
    tenantId: null,
    now);

// --- Tenant ---
var tenant = await tenants.Find(t => t.Slug == slug).FirstOrDefaultAsync();
if (tenant is null)
{
    tenant = new Tenant
    {
        Id = ObjectId.GenerateNewId(),
        Slug = slug,
        Name = tenantName,
        Status = "active",
        Branding = new Branding
        {
            DisplayName = tenantName,
            PrimaryColor = "#1a5f2a",
            SecondaryColor = "#0d3d1a",
            PrimaryContrast = "#ffffff",
            HeaderBg = "#102418",
            HeaderText = "#f8f9fa",
            SidebarBg = "#ffffff",
            SidebarText = "#212529",
            PageBg = "#f3f4f6",
            ThemeMode = "light",
        },
        Settings = new TenantSettings
        {
            SeedOnCreate = false,
            Vocabulary = new Dictionary<string, object?>
            {
                ["funcionario"] = "Servidor",
                ["setor"] = "Secretaria",
                ["subsetor"] = "Setor",
                ["cargo"] = "Cargo",
                ["referencia"] = "Referência",
            },
        },
        CreatedAt = now,
        UpdatedAt = now,
    };
    await tenants.InsertOneAsync(tenant);
    Console.WriteLine($"Created tenant {slug} id={tenant.Id}");
}
else
{
    var update = Builders<Tenant>.Update
        .Set(t => t.Name, tenantName)
        .Set(t => t.Status, "active")
        .Set(t => t.UpdatedAt, now)
        .Set(t => t.Branding.DisplayName, tenantName);
    await tenants.UpdateOneAsync(t => t.Id == tenant.Id, update);
    Console.WriteLine($"Updated tenant {slug} id={tenant.Id}");
}

var tenantId = tenant.Id;
var existingCount = await funcionarios.CountDocumentsAsync(f => f.TenantId == tenantId);
if (existingCount > 0 && !reset)
{
    Console.WriteLine($"Tenant already has {existingCount} funcionários.");
    Console.WriteLine("Skipping data seed. Re-run with --reset (or SEED_DEMO_RESET=true) to wipe and recreate demo data.");
}
else
{
    if (existingCount > 0)
    {
        Console.WriteLine("Resetting tenant demo data...");
        await setors.DeleteManyAsync(x => x.TenantId == tenantId);
        await funcionarios.DeleteManyAsync(x => x.TenantId == tenantId);
        await references.DeleteManyAsync(x => x.TenantId == tenantId);
        await cargos.DeleteManyAsync(x => x.TenantId == tenantId);
        await simbologias.DeleteManyAsync(x => x.TenantId == tenantId);
        await audit.DeleteManyAsync(x => x.TenantId == tenantId);
    }

    await SeedTenantDataAsync(
        setors, funcionarios, references, cargos, simbologias, audit,
        tenantId, now);
}

// --- Tenant users (always upsert) ---
var demoUsers = new (string LoginId, string Username, string Role)[]
{
    ("owner-demo", "Owner Demo", Roles.Owner),
    ("admin-demo", "Admin Demo", Roles.Admin),
    ("user-demo", "User Demo", Roles.User),
    ("readonly-demo", "Readonly Demo", Roles.Readonly),
};

foreach (var u in demoUsers)
{
    await UpsertUserAsync(users, u.LoginId, u.Username, demoPassword, u.Role, tenantId, now);
}

PrintSummary(slug, demoPassword, superLoginId, superPassword);
return;

// ---------------------------------------------------------------------------

static async Task SeedTenantDataAsync(
    IMongoCollection<Setor> setors,
    IMongoCollection<Funcionario> funcionarios,
    IMongoCollection<Reference> references,
    IMongoCollection<CargoComissionado> cargos,
    IMongoCollection<LimiteSimbologia> simbologias,
    IMongoCollection<AuditLog> audit,
    ObjectId tenantId,
    DateTime now)
{
    // Setor tree
    var secAdm = NewSetor("Secretaria de Administração", "Setor", null, tenantId, now);
    var secSaude = NewSetor("Secretaria de Saúde", "Setor", null, tenantId, now);
    var secEduc = NewSetor("Secretaria de Educação", "Setor", null, tenantId, now);
    var secObras = NewSetor("Secretaria de Obras", "Setor", null, tenantId, now);
    var secAssist = NewSetor("Secretaria de Assistência Social", "Setor", null, tenantId, now);
    var roots = new[] { secAdm, secSaude, secEduc, secObras, secAssist };
    await setors.InsertManyAsync(roots);

    var children = new List<Setor>
    {
        NewSetor("RH e Folha", "Subsetor", secAdm.Id, tenantId, now),
        NewSetor("Tecnologia da Informação", "Subsetor", secAdm.Id, tenantId, now),
        NewSetor("Compras e Licitações", "Subsetor", secAdm.Id, tenantId, now),
        NewSetor("Atenção Básica", "Subsetor", secSaude.Id, tenantId, now),
        NewSetor("Vigilância Sanitária", "Subsetor", secSaude.Id, tenantId, now),
        NewSetor("Farmácia Municipal", "Subsetor", secSaude.Id, tenantId, now),
        NewSetor("Ensino Fundamental", "Subsetor", secEduc.Id, tenantId, now),
        NewSetor("Transporte Escolar", "Subsetor", secEduc.Id, tenantId, now),
        NewSetor("Infraestrutura Urbana", "Subsetor", secObras.Id, tenantId, now),
        NewSetor("Habitação", "Subsetor", secObras.Id, tenantId, now),
        NewSetor("CRAS Centro", "Subsetor", secAssist.Id, tenantId, now),
        NewSetor("CREAS", "Subsetor", secAssist.Id, tenantId, now),
    };
    await setors.InsertManyAsync(children);

    var lotacoes = children.Concat(roots).ToList();
    Console.WriteLine($"Setores: {roots.Length} secretarias + {children.Count} subsetores");

    // Simbologias (limite = total de vagas — dashboard conta ocupadas dinamicamente)
    var simbologiaDefs = new (string Code, int Limite)[]
    {
        ("DAS-1", 12),
        ("DAS-2", 10),
        ("DAS-3", 8),
        ("CC-1", 15),
        ("CC-2", 6),
    };
    await simbologias.InsertManyAsync(simbologiaDefs.Select(s => new LimiteSimbologia
    {
        Id = ObjectId.GenerateNewId(),
        Simbologia = s.Code,
        Limite = s.Limite,
        TenantId = tenantId,
    }));

    var cargoDefs = new (string Tipo, string Cargo, string Simb, double Salario)[]
    {
        ("Direção", "Secretário Municipal", "DAS-1", 18000),
        ("Direção", "Secretário Adjunto", "DAS-2", 14000),
        ("Direção", "Diretor de Departamento", "DAS-3", 11000),
        ("Assessoria", "Assessor Técnico", "CC-1", 6500),
        ("Assessoria", "Chefe de Gabinete", "CC-2", 9500),
        ("Assessoria", "Assessor de Comunicação", "CC-1", 5800),
        ("Coordenação", "Coordenador de Unidade", "DAS-3", 8200),
    };
    await cargos.InsertManyAsync(cargoDefs.Select(c => new CargoComissionado
    {
        Id = ObjectId.GenerateNewId(),
        Tipo = c.Tipo,
        Cargo = c.Cargo,
        Simbologia = c.Simb,
        ADefinir = c.Salario,
        TenantId = tenantId,
    }));
    Console.WriteLine($"Cargos/simbologias: {cargoDefs.Length} cargos, {simbologiaDefs.Length} cotas");

    // Referências externas (cadeia política)
    var refPrefeito = new Reference
    {
        Id = ObjectId.GenerateNewId(),
        Name = "PREFEITO MUNICIPAL",
        Cargo = "Prefeito",
        Telefone = "(85) 90000-0001",
        Origem = "externa",
        ParentId = null,
        TenantId = tenantId,
    };
    var refVereador = new Reference
    {
        Id = ObjectId.GenerateNewId(),
        Name = "VEREADOR JOÃO BATISTA",
        Cargo = "Vereador",
        Telefone = "(85) 90000-0002",
        Origem = "externa",
        ParentId = refPrefeito.Id,
        TenantId = tenantId,
    };
    var refLideranca = new Reference
    {
        Id = ObjectId.GenerateNewId(),
        Name = "LIDERANÇA COMUNITÁRIA MARIA",
        Cargo = "Liderança",
        Telefone = "(85) 90000-0003",
        Origem = "externa",
        ParentId = refVereador.Id,
        TenantId = tenantId,
    };
    var refExterna = new[] { refPrefeito, refVereador, refLideranca };
    await references.InsertManyAsync(refExterna);

    // Funcionários
    var rng = new Random(42);
    var firstNames = new[]
    {
        "Ana", "Bruno", "Carla", "Diego", "Elena", "Fábio", "Gisele", "Hugo", "Iris", "João",
        "Karina", "Lucas", "Marina", "Nuno", "Olívia", "Paulo", "Queila", "Rafael", "Sara", "Tiago",
        "Úrsula", "Vitor", "Wagner", "Yara", "Zeca", "Beatriz", "Caio", "Daniele", "Eduardo", "Fernanda",
    };
    var lastNames = new[]
    {
        "Silva", "Santos", "Oliveira", "Souza", "Lima", "Ferreira", "Alves", "Pereira", "Costa", "Rodrigues",
        "Martins", "Araújo", "Ribeiro", "Carvalho", "Gomes", "Barbosa", "Rocha", "Dias", "Nunes", "Mendes",
    };

    var efetivoFuncoes = new[]
    {
        "Analista Administrativo", "Auxiliar de Serviços Gerais", "Assistente Social",
        "Enfermeiro", "Técnico de Enfermagem", "Professor", "Motorista", "Engenheiro Civil",
        "Contador", "Agente de Saúde", "Psicólogo", "Pedagogo",
    };

    var list = new List<Funcionario>();
    var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    string UniqueName()
    {
        for (var attempt = 0; attempt < 200; attempt++)
        {
            var n = $"{firstNames[rng.Next(firstNames.Length)]} {lastNames[rng.Next(lastNames.Length)]}";
            if (usedNames.Add(n)) return n;
        }
        var fallback = $"Servidor Demo {usedNames.Count + 1}";
        usedNames.Add(fallback);
        return fallback;
    }

    ObjectId PickLotacao() => lotacoes[rng.Next(lotacoes.Count)].Id;
    string SecretariaOf(ObjectId setorId)
    {
        var node = lotacoes.First(s => s.Id == setorId);
        while (node.Parent is ObjectId p)
            node = lotacoes.First(s => s.Id == p);
        return node.Nome;
    }

    // Comissionados (~28) — respeitando cotas aproximadas
    var comissionPlan = new List<(string Cargo, string Simb, double Salario)>();
    void PlanComiss(string cargo, string simb, double sal, int n)
    {
        for (var i = 0; i < n; i++)
            comissionPlan.Add((cargo, simb, sal));
    }
    PlanComiss("Secretário Municipal", "DAS-1", 18000, 5);
    PlanComiss("Secretário Adjunto", "DAS-2", 14000, 4);
    PlanComiss("Diretor de Departamento", "DAS-3", 11000, 5);
    PlanComiss("Coordenador de Unidade", "DAS-3", 8200, 3);
    PlanComiss("Assessor Técnico", "CC-1", 6500, 7);
    PlanComiss("Assessor de Comunicação", "CC-1", 5800, 3);
    PlanComiss("Chefe de Gabinete", "CC-2", 9500, 3);

    var refPool = new[] { refPrefeito, refVereador, refLideranca };
    foreach (var (cargo, _, salario) in comissionPlan)
    {
        var setorId = PickLotacao();
        var referencia = refPool[rng.Next(refPool.Length)];
        list.Add(new Funcionario
        {
            Id = ObjectId.GenerateNewId(),
            Nome = UniqueName(),
            Secretaria = SecretariaOf(setorId),
            Funcao = cargo,
            Natureza = "COMISSIONADO",
            Tipo = "Comissionado",
            Referencia = referencia.Name,
            ReferenciaId = referencia.Id,
            SalarioBruto = salario,
            Cidade = "Maranguape",
            Bairro = "Centro",
            Telefone = $"(85) 9{rng.Next(1000, 9999)}-{rng.Next(1000, 9999)}",
            SetorId = setorId,
            TenantId = tenantId,
            CreatedAt = now.AddDays(-rng.Next(30, 400)),
            FimContrato = FimContrato.Indeterminado,
        });
    }

    // Efetivos (~30)
    for (var i = 0; i < 30; i++)
    {
        var setorId = PickLotacao();
        var funcao = efetivoFuncoes[rng.Next(efetivoFuncoes.Length)];
        list.Add(new Funcionario
        {
            Id = ObjectId.GenerateNewId(),
            Nome = UniqueName(),
            Secretaria = SecretariaOf(setorId),
            Funcao = funcao,
            Natureza = "EFETIVO",
            Tipo = "Efetivo",
            SalarioBruto = 2200 + rng.Next(0, 60) * 100,
            Cidade = "Maranguape",
            Bairro = new[] { "Centro", "Novo Oriente", "Pacatuba", "Itapebussu" }[rng.Next(4)],
            Telefone = $"(85) 9{rng.Next(1000, 9999)}-{rng.Next(1000, 9999)}",
            SetorId = setorId,
            TenantId = tenantId,
            CreatedAt = now.AddDays(-rng.Next(60, 1200)),
            FimContrato = FimContrato.Indeterminado,
        });
    }

    // Temporários (~18) — alguns a vencer em 30/60/90 dias
    var vencimentos = new[]
    {
        now.AddDays(12), now.AddDays(20), now.AddDays(28),
        now.AddDays(40), now.AddDays(50), now.AddDays(55),
        now.AddDays(70), now.AddDays(85), now.AddDays(95),
        now.AddDays(120), now.AddDays(150), now.AddDays(180),
        now.AddDays(200), now.AddDays(250), now.AddDays(300),
        now.AddDays(15), now.AddDays(45), now.AddDays(75),
    };
    for (var i = 0; i < vencimentos.Length; i++)
    {
        var setorId = PickLotacao();
        var referencia = rng.NextDouble() < 0.6 ? refPool[rng.Next(refPool.Length)] : null;
        list.Add(new Funcionario
        {
            Id = ObjectId.GenerateNewId(),
            Nome = UniqueName(),
            Secretaria = SecretariaOf(setorId),
            Funcao = efetivoFuncoes[rng.Next(efetivoFuncoes.Length)],
            Natureza = "TEMPORARIO",
            Tipo = "Temporário",
            Referencia = referencia?.Name,
            ReferenciaId = referencia?.Id,
            SalarioBruto = 1800 + rng.Next(0, 40) * 50,
            Cidade = "Maranguape",
            Bairro = "Centro",
            Telefone = $"(85) 9{rng.Next(1000, 9999)}-{rng.Next(1000, 9999)}",
            SetorId = setorId,
            InicioContrato = now.AddMonths(-rng.Next(3, 18)),
            FimContrato = FimContrato.FromDate(DateTime.SpecifyKind(vencimentos[i], DateTimeKind.Utc)),
            TenantId = tenantId,
            CreatedAt = now.AddDays(-rng.Next(10, 200)),
        });
    }

    await funcionarios.InsertManyAsync(list);
    Console.WriteLine($"Funcionários: {list.Count} " +
                      $"(COMISSIONADO={list.Count(f => f.Natureza == "COMISSIONADO")}, " +
                      $"EFETIVO={list.Count(f => f.Natureza == "EFETIVO")}, " +
                      $"TEMPORARIO={list.Count(f => f.Natureza == "TEMPORARIO")})");

    // Referências origem=funcionario (vínculo 1:1) — amostra de comissionados
    var refFuncs = new List<Reference>();
    foreach (var f in list.Where(x => x.Natureza == "COMISSIONADO").Take(8))
    {
        refFuncs.Add(new Reference
        {
            Id = ObjectId.GenerateNewId(),
            Name = f.Nome.ToUpperInvariant(),
            Cargo = f.Funcao,
            Telefone = f.Telefone,
            Origem = "funcionario",
            FuncionarioId = f.Id,
            ParentId = refVereador.Id,
            TenantId = tenantId,
        });
    }
    if (refFuncs.Count > 0)
        await references.InsertManyAsync(refFuncs);
    Console.WriteLine($"Referências: {refExterna.Length} externas + {refFuncs.Count} vinculadas a funcionários");

    // Audit trail de demonstração
    var auditRows = new List<AuditLog>
    {
        new()
        {
            Id = ObjectId.GenerateNewId(),
            TenantId = tenantId,
            Action = "seed",
            Entity = "tenant",
            EntityId = tenantId.ToString(),
            Meta = new BsonDocument { ["source"] = "SeedDemo", ["count"] = list.Count },
            CreatedAt = now,
            UpdatedAt = now,
        },
        new()
        {
            Id = ObjectId.GenerateNewId(),
            TenantId = tenantId,
            Action = "create",
            Entity = "funcionario",
            EntityId = list[0].Id.ToString(),
            Meta = new BsonDocument { ["nome"] = list[0].Nome },
            CreatedAt = now.AddHours(-5),
            UpdatedAt = now.AddHours(-5),
        },
        new()
        {
            Id = ObjectId.GenerateNewId(),
            TenantId = tenantId,
            Action = "update",
            Entity = "setor",
            EntityId = secAdm.Id.ToString(),
            Meta = new BsonDocument { ["nome"] = secAdm.Nome },
            CreatedAt = now.AddHours(-2),
            UpdatedAt = now.AddHours(-2),
        },
    };
    await audit.InsertManyAsync(auditRows);
    Console.WriteLine($"Audit logs: {auditRows.Count}");
}

static Setor NewSetor(string nome, string tipo, ObjectId? parent, ObjectId tenantId, DateTime now) => new()
{
    Id = ObjectId.GenerateNewId(),
    Nome = nome,
    Tipo = tipo,
    Parent = parent,
    TenantId = tenantId,
    CreatedAt = now,
};

static async Task UpsertUserAsync(
    IMongoCollection<User> users,
    string loginId,
    string username,
    string password,
    string role,
    ObjectId? tenantId,
    DateTime now)
{
    var hash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 10);
    var existing = await users.Find(u => u.LoginId == loginId).FirstOrDefaultAsync();
    if (existing is null)
    {
        await users.InsertOneAsync(new User
        {
            LoginId = loginId,
            Username = username,
            PasswordHash = hash,
            Role = role,
            TenantId = tenantId,
            CreatedAt = now,
            UpdatedAt = now,
        });
        Console.WriteLine($"Created user loginId={loginId} role={role}");
        return;
    }

    var update = Builders<User>.Update
        .Set(u => u.Username, username)
        .Set(u => u.PasswordHash, hash)
        .Set(u => u.Role, role)
        .Set(u => u.TenantId, tenantId)
        .Set(u => u.UpdatedAt, now);
    await users.UpdateOneAsync(u => u.Id == existing.Id, update);
    Console.WriteLine($"Updated user loginId={loginId} role={role}");
}

static void PrintSummary(string slug, string demoPassword, string superLoginId, string superPassword)
{
    Console.WriteLine();
    Console.WriteLine("=== Contas de demonstração ===");
    Console.WriteLine($"Platform (master): ID={superLoginId}  senha={superPassword}  role=superadmin");
    Console.WriteLine($"Tenant `{slug}` (mesma senha para todos): {demoPassword}");
    Console.WriteLine("  owner-demo      → owner      (dashboard, usuários, tudo)");
    Console.WriteLine("  admin-demo      → admin      (dashboard, sem gerir usuários)");
    Console.WriteLine("  user-demo       → user       (organograma / criar funcionário)");
    Console.WriteLine("  readonly-demo   → readonly   (leitura autenticada)");
    Console.WriteLine();
    Console.WriteLine("Front local: http://master.localhost:5173  |  http://demo.localhost:5173");
    Console.WriteLine("Login body: POST /api/usuarios/login  { \"id\", \"password\" }");
}

static string? Env(string key) =>
    Environment.GetEnvironmentVariable(key);

static bool IsTruthy(string? value) =>
    string.Equals(value, "1", StringComparison.OrdinalIgnoreCase)
    || string.Equals(value, "true", StringComparison.OrdinalIgnoreCase)
    || string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase);

static string MaskUri(string uri)
{
    try
    {
        var u = new MongoUrl(uri);
        if (string.IsNullOrEmpty(u.Password)) return uri;
        return uri.Replace(u.Password, "***", StringComparison.Ordinal);
    }
    catch
    {
        return uri;
    }
}

static string? FindEnvFile()
{
    // Prefer an .env that actually defines the Mongo URI (avoid picking the frontend .env).
    var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
    string? fallback = null;
    while (dir is not null)
    {
        var candidate = Path.Combine(dir.FullName, ".env");
        if (File.Exists(candidate))
        {
            fallback ??= candidate;
            foreach (var raw in File.ReadLines(candidate))
            {
                var line = raw.Trim();
                if (line.StartsWith("MONGO_CONNECTING_FUNCIONARIOS=", StringComparison.Ordinal)
                    || line.StartsWith("MONGO_CONNECTING_USUARIOS=", StringComparison.Ordinal))
                    return candidate;
            }
        }

        // Also check sibling api-maranguape when started from the frontend repo.
        var sibling = Path.Combine(dir.FullName, "api-maranguape", ".env");
        if (File.Exists(sibling))
        {
            foreach (var raw in File.ReadLines(sibling))
            {
                var line = raw.Trim();
                if (line.StartsWith("MONGO_CONNECTING_FUNCIONARIOS=", StringComparison.Ordinal)
                    || line.StartsWith("MONGO_CONNECTING_USUARIOS=", StringComparison.Ordinal))
                    return sibling;
            }
        }

        dir = dir.Parent;
    }

    // Explicit path next to this tool: tools/SeedDemo → ../../.env
    var fromTool = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".env"));
    if (File.Exists(fromTool)) return fromTool;

    return fallback;
}

static void LoadDotEnv(string? path)
{
    if (path is null || !File.Exists(path)) return;
    foreach (var raw in File.ReadAllLines(path))
    {
        var line = raw.Trim();
        if (line.Length == 0 || line.StartsWith('#')) continue;
        var idx = line.IndexOf('=');
        if (idx <= 0) continue;
        var key = line[..idx].Trim();
        var value = line[(idx + 1)..].Trim().Trim('"').Trim('\'');
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
            Environment.SetEnvironmentVariable(key, value);
    }
    Console.WriteLine($"Loaded env from {path}");
}
