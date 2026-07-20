import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { SearchRepository } from './search.repository';

type SetorInfo = { id: unknown; nome: string; tipo: string };
type SearchTermo = { nome: string; tipo: string };

/**
 * Ported from legacy/services/searchService.js.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly searchRepository: SearchRepository,
    private readonly s3Service: S3Service,
  ) {}

  async autocomplete(termo: string | undefined, tenantId: string | null = null) {
    if (!termo) {
      throw new AppError('Termo não informado', 400, 'BAD_REQUEST');
    }

    const funcionarios = await this.searchRepository.autocompleteFuncionarios(
      termo,
      tenantId,
    );
    const setores = await this.searchRepository.autocompleteSetores(termo, tenantId);

    const todosTermos: SearchTermo[] = [
      ...funcionarios.map((x: { termo: SearchTermo }) => x.termo),
      ...setores.map((x: { termo: SearchTermo }) => x.termo),
    ];

    const unicos = todosTermos.filter(
      (item, index, self) =>
        index === self.findIndex((t) => t.nome === item.nome && t.tipo === item.tipo),
    );

    return unicos;
  }

  async searchFuncionarios(q: string | undefined, tenantId: string | null = null) {
    if (!q) {
      throw new AppError('Parâmetro de busca "q" é obrigatório.', 400, 'BAD_REQUEST');
    }

    const setoresEncontrados = await this.searchRepository.searchSetores(q, tenantId);

    let funcionariosIds: unknown[] = [];
    const setoresInfo: SetorInfo[] = [];

    for (const setor of setoresEncontrados as { _id: unknown; nome: string; tipo: string }[]) {
      const idsToMatch = await this.searchRepository.findChildIds(setor._id, tenantId);
      const funcs = await this.searchRepository.findFuncionariosBySetorId(
        { $in: idsToMatch },
        tenantId,
      );
      funcionariosIds.push(...funcs.map((f) => f._id));

      setoresInfo.push({ id: setor._id, nome: setor.nome, tipo: setor.tipo });
    }

    const funcionariosDiretos = await this.searchRepository.searchFuncionariosDirectly(
      q,
      tenantId,
    );

    const todosIds = [...funcionariosIds, ...funcionariosDiretos.map((f) => f._id)];

    const idsUnicos = [...new Set(todosIds.map((id) => String(id)))].map(
      (id) => new Types.ObjectId(id),
    );

    const resultados =
      idsUnicos.length > 0
        ? await this.searchRepository.getFuncionariosByIds(idsUnicos, tenantId)
        : [];

    const funcionariosComMidias = await Promise.all(
      resultados.map(async (funcionario) => {
        const base = (
          typeof (funcionario as { toObject?: () => Record<string, unknown> }).toObject ===
          'function'
            ? (funcionario as { toObject: () => Record<string, unknown> }).toObject()
            : funcionario
        ) as Record<string, unknown>;

        const fotoUrl = base.foto
          ? await this.s3Service.gerarUrlPreAssinada(String(base.foto))
          : null;

        const arquivoUrl = base.arquivo
          ? await this.s3Service.gerarUrlPreAssinada(String(base.arquivo))
          : null;

        return { ...base, fotoUrl, arquivoUrl };
      }),
    );

    return {
      funcionarios: funcionariosComMidias,
      setoresEncontrados: setoresInfo,
    };
  }
}
