using Organograma.Application.Abstractions;
using Organograma.Application.Funcionarios;
using Organograma.Domain;
using MongoDB.Bson;

namespace Organograma.Application.Search;

public sealed class SearchService(ISearchRepository searchRepository, IS3Service s3Service)
{
    public async Task<object> AutocompleteAsync(string? termo, string? tenantId = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(termo))
            throw new AppException("Termo não informado", 400, "BAD_REQUEST");

        var funcionarios = await searchRepository.AutocompleteFuncionariosAsync(termo, tenantId, ct);
        var setores = await searchRepository.AutocompleteSetoresAsync(termo, tenantId, ct);

        var todosTermos = new List<(string Nome, string Tipo)>();
        foreach (var doc in funcionarios.Concat(setores))
        {
            if (!doc.TryGetValue("termo", out var termoVal) || !termoVal.IsBsonDocument) continue;
            var t = termoVal.AsBsonDocument;
            var nome = t.GetValue("nome", "").ToString() ?? "";
            var tipo = t.GetValue("tipo", "").ToString() ?? "";
            todosTermos.Add((nome, tipo));
        }

        var unicos = todosTermos
            .Where((item, index) =>
                todosTermos.FindIndex(t => t.Nome == item.Nome && t.Tipo == item.Tipo) == index)
            .Select(t => new { nome = t.Nome, tipo = t.Tipo })
            .ToList();

        return unicos;
    }

    public async Task<object> SearchFuncionariosAsync(
        string? q,
        string? tenantId = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q))
            throw new AppException("Parâmetro de busca \"q\" é obrigatório.", 400, "BAD_REQUEST");

        var setoresEncontrados = await searchRepository.SearchSetoresAsync(q, tenantId, ct);

        var funcionariosIds = new List<ObjectId>();
        var setoresInfo = new List<object>();

        foreach (var setor in setoresEncontrados)
        {
            var setorId = setor.GetValue("_id", BsonNull.Value);
            var idsToMatch = await searchRepository.GetDescendantIdsAsync(setorId, tenantId, ct);
            var funcs = await searchRepository.FindFuncionarioIdsBySetorIdsAsync(idsToMatch, tenantId, ct);
            funcionariosIds.AddRange(funcs);

            setoresInfo.Add(new
            {
                id = setorId.IsObjectId ? setorId.AsObjectId.ToString() : setorId.ToString(),
                nome = setor.GetValue("nome", "").ToString() ?? "",
                tipo = setor.GetValue("tipo", "").ToString() ?? "",
            });
        }

        var funcionariosDiretos = await searchRepository.SearchFuncionariosDirectlyAsync(q, tenantId, ct);
        funcionariosIds.AddRange(funcionariosDiretos);

        var idsUnicos = funcionariosIds
            .Select(id => id.ToString())
            .Distinct()
            .Where(id => ObjectId.TryParse(id, out _))
            .Select(ObjectId.Parse)
            .ToList();

        var resultados = idsUnicos.Count > 0
            ? await searchRepository.GetFuncionariosByIdsAsync(idsUnicos, tenantId, ct)
            : [];

        var funcionariosComMidias = new List<object>();
        foreach (var funcionario in resultados)
        {
            var fotoUrl = !string.IsNullOrEmpty(funcionario.Foto)
                ? await s3Service.GerarUrlPreAssinadaAsync(funcionario.Foto, ct)
                : null;
            var arquivoUrl = !string.IsNullOrEmpty(funcionario.Arquivo)
                ? await s3Service.GerarUrlPreAssinadaAsync(funcionario.Arquivo, ct)
                : null;

            funcionariosComMidias.Add(FuncionarioMapper.ToDict(funcionario, fotoUrl, arquivoUrl));
        }

        return new
        {
            funcionarios = funcionariosComMidias,
            setoresEncontrados = setoresInfo,
        };
    }
}
