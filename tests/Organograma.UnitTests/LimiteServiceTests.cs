using Organograma.Application.Abstractions;
using Organograma.Application.Funcionarios;
using Organograma.Domain.Entities;
using MongoDB.Bson;

namespace Organograma.UnitTests;

public class LimiteServiceTests
{
    [Fact]
    public async Task Leaving_comissionado_increments_limite()
    {
        var repo = new FakeCargoRepo
        {
            Cargos =
            {
                ["Analista"] = new CargoComissionado
                {
                    Id = ObjectId.GenerateNewId(),
                    Cargo = "Analista",
                    Simbologia = "DAS-1",
                },
            },
            Limites =
            {
                ["DAS-1"] = new LimiteSimbologia
                {
                    Id = ObjectId.GenerateNewId(),
                    Simbologia = "DAS-1",
                    Limite = 3,
                },
            },
        };
        var service = new LimiteService(repo);

        await service.AtualizarLimitesDeFuncaoAsync(
            "Analista",
            "Outro",
            "COMISSIONADO",
            "EFETIVO");

        Assert.Equal(4, repo.Limites["DAS-1"].Limite);
        Assert.Contains(("DAS-1", 4), repo.Updates);
    }

    [Fact]
    public async Task Entering_comissionado_decrements_limite()
    {
        var repo = new FakeCargoRepo
        {
            Cargos =
            {
                ["Chefe"] = new CargoComissionado
                {
                    Id = ObjectId.GenerateNewId(),
                    Cargo = "Chefe",
                    Simbologia = "DAS-2",
                },
            },
            Limites =
            {
                ["DAS-2"] = new LimiteSimbologia
                {
                    Id = ObjectId.GenerateNewId(),
                    Simbologia = "DAS-2",
                    Limite = 5,
                },
            },
        };
        var service = new LimiteService(repo);

        await service.AtualizarLimitesDeFuncaoAsync(
            "Outro",
            "Chefe",
            "EFETIVO",
            "COMISSIONADO");

        Assert.Equal(4, repo.Limites["DAS-2"].Limite);
        Assert.Contains(("DAS-2", 4), repo.Updates);
    }

    [Fact]
    public async Task Non_comissionado_changes_do_nothing()
    {
        var repo = new FakeCargoRepo();
        var service = new LimiteService(repo);

        await service.AtualizarLimitesDeFuncaoAsync(
            "A",
            "B",
            "EFETIVO",
            "EFETIVO");

        Assert.Empty(repo.Updates);
    }

    private sealed class FakeCargoRepo : ICargosComissionadosRepository
    {
        public Dictionary<string, CargoComissionado> Cargos { get; } = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, LimiteSimbologia> Limites { get; } = new(StringComparer.OrdinalIgnoreCase);
        public List<(string Simbologia, int Limite)> Updates { get; } = [];

        public Task<IReadOnlyList<BsonDocument>> BuscarTodosAsync(string? tenantId, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<BsonDocument>>([]);

        public Task<CargoComissionado?> BuscarPorIdAsync(string id, string? tenantId, CancellationToken ct = default)
            => Task.FromResult<CargoComissionado?>(null);

        public Task<CargoComissionado?> BuscarPorNomeAsync(string nome, string? tenantId, CancellationToken ct = default)
            => Task.FromResult(Cargos.GetValueOrDefault(nome));

        public Task<CargoComissionado> CriarAsync(CargoComissionado cargo, CancellationToken ct = default)
            => Task.FromResult(cargo);

        public Task<CargoComissionado?> AtualizarAsync(string id, CargoComissionado patch, string? tenantId, CancellationToken ct = default)
            => Task.FromResult<CargoComissionado?>(patch);

        public Task<CargoComissionado?> RemoverAsync(string id, string? tenantId, CancellationToken ct = default)
            => Task.FromResult<CargoComissionado?>(null);

        public Task<LimiteSimbologia?> BuscarPorSimbologiaAsync(string simbologia, string? tenantId, CancellationToken ct = default)
            => Task.FromResult(Limites.GetValueOrDefault(simbologia));

        public Task<LimiteSimbologia?> UpsertSimbologiaAsync(
            string simbologia, int? limite, string? tenantId, string? userId, CancellationToken ct = default)
            => Task.FromResult<LimiteSimbologia?>(null);

        public Task<LimiteSimbologia?> UpdateLimiteAsync(
            string simbologia, int novoLimite, string? tenantId, CancellationToken ct = default)
        {
            Updates.Add((simbologia, novoLimite));
            if (Limites.TryGetValue(simbologia, out var existing))
            {
                existing.Limite = novoLimite;
                return Task.FromResult<LimiteSimbologia?>(existing);
            }

            var created = new LimiteSimbologia { Simbologia = simbologia, Limite = novoLimite };
            Limites[simbologia] = created;
            return Task.FromResult<LimiteSimbologia?>(created);
        }
    }
}
