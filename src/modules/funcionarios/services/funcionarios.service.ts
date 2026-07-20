import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppError } from '../../../common/errors/app-error';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { S3Service } from '../../../infrastructure/s3/s3.service';
import { normalizarTexto } from '../../../common/utils/normalizar-texto';
import { Setor, SetorDocument } from '../../setores/schemas/setor.schema';
import { FuncionariosRepository } from '../repositories/funcionarios.repository';
import { CargoLookupRepository } from '../repositories/cargo-lookup.repository';
import { LimiteService } from './limite.service';
import { normalizeObservacoes, ObservacaoInput } from '../utils/normalize-observacoes';
import { ListFilters, PaginatedResult } from '../types/list-filters.type';
import { FuncionarioDto } from '../dto/funcionario.dto';

const BATCH_SIZE = 100;
const MAX_BATCH_CONCURRENCY = 2;
const MAX_LIST_LIMIT = 200;
const DEFAULT_LIST_LIMIT = 50;

type MulterFiles = {
  foto?: Express.Multer.File[];
  arquivo?: Express.Multer.File[];
};

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  workerFn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await workerFn(items[index], index);
    }
  }

  const poolSize = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));
  return results;
}

function resolveSetorId(body: { setorId?: string; coordenadoria?: string } = {}) {
  return body.setorId || body.coordenadoria || null;
}

function lotacaoIdOf(funcionario: {
  setorId?: unknown;
  coordenadoria?: unknown;
} | null): unknown {
  if (!funcionario) return null;
  return funcionario.setorId || funcionario.coordenadoria || null;
}

function escapeCsv(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function clampLimit(limit: unknown, fallback = DEFAULT_LIST_LIMIT): number {
  const n = parseInt(String(limit), 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return Math.min(n, MAX_LIST_LIMIT);
}

function clampPage(page: unknown): number {
  const n = parseInt(String(page), 10);
  if (Number.isNaN(n) || n < 1) return 1;
  return n;
}

function hasActiveFilters(filters: ListFilters = {}): boolean {
  return Object.values(filters).some((v) => v != null && String(v).trim() !== '');
}

function tenantCachePrefix(tenantId: string | null): string {
  return tenantId ? `tenant:${tenantId}:` : '';
}

/**
 * Ported from legacy/services/funcionariosService.js.
 */
@Injectable()
export class FuncionariosService {
  constructor(
    private readonly funcionariosRepository: FuncionariosRepository,
    private readonly cargoLookup: CargoLookupRepository,
    private readonly limiteService: LimiteService,
    private readonly cacheService: CacheService,
    private readonly s3Service: S3Service,
    @InjectModel(Setor.name) private readonly setorModel: Model<SetorDocument>,
  ) {}

  private findSetorByIds(ids: unknown[], tenantId: string | null = null) {
    return this.setorModel.find({
      _id: { $in: ids },
      ...(tenantId
        ? {
            tenantId: Types.ObjectId.isValid(tenantId)
              ? new Types.ObjectId(tenantId)
              : tenantId,
          }
        : {}),
    });
  }

  async buscarFuncionarios(
    page = 1,
    limit = DEFAULT_LIST_LIMIT,
    tenantId: string | null = null,
    filters: ListFilters = {},
  ): Promise<PaginatedResult<unknown>> {
    const pageNum = clampPage(page);
    const limitNum = clampLimit(limit);
    const skip = (pageNum - 1) * limitNum;
    const filterKey = hasActiveFilters(filters)
      ? `:f:${JSON.stringify(filters)}`
      : '';
    const cacheKey = `${tenantCachePrefix(tenantId)}todos:funcionarios:page${pageNum}:l${limitNum}${filterKey}`;

    return this.withFotoUrls(
      await this.cacheService.getOrSetCache(cacheKey, async () => {
        const [total, funcionarios] = await Promise.all([
          this.funcionariosRepository.countWithFilters(filters, tenantId),
          this.funcionariosRepository.findWithFilters(
            filters,
            skip,
            limitNum,
            tenantId,
          ),
        ]);

        return {
          funcionarios,
          total,
          page: pageNum,
          pages: Math.max(1, Math.ceil(total / limitNum)),
        };
      }),
    );
  }

  /**
   * Paginated listing for pickers (references, etc.) with search + filters.
   * Not Redis-cached — results depend on free-text `q`.
   */
  async buscarParaSelecao(
    {
      q = '',
      natureza = '',
      secretaria = '',
      funcao = '',
      page = 1,
      limit = 15,
      incluirFiltros = false,
    }: {
      q?: string;
      natureza?: string;
      secretaria?: string;
      funcao?: string;
      page?: number | string;
      limit?: number | string;
      incluirFiltros?: boolean;
    } = {},
    tenantId: string | null = null,
  ) {
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 15));
    const skip = (pageNum - 1) * limitNum;
    const filters: ListFilters = { q, natureza, secretaria, funcao };

    const [total, funcionarios, filtros] = await Promise.all([
      this.funcionariosRepository.countParaSelecao(filters, tenantId),
      this.funcionariosRepository.findParaSelecao(filters, skip, limitNum, tenantId),
      incluirFiltros
        ? this.funcionariosRepository.distinctFiltrosSelecao(tenantId)
        : Promise.resolve(null),
    ]);

    const result: PaginatedResult<unknown> & { filtros?: unknown } = {
      funcionarios,
      total,
      page: pageNum,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    };

    if (filtros) {
      result.filtros = filtros;
    }

    return result;
  }

  async getFiltrosDisponiveis(tenantId: string | null = null) {
    const cacheKey = `${tenantCachePrefix(tenantId)}funcionarios:filtros`;
    return this.cacheService.getOrSetCache(cacheKey, async () =>
      this.funcionariosRepository.distinctFiltrosSelecao(tenantId),
    );
  }

  /** Presigned media URLs for a single employee (detail/modal). */
  async getMidiaUrls(id: string, tenantId: string | null = null) {
    const funcionario = await this.funcionariosRepository.findById(id, tenantId);
    if (!funcionario) {
      throw new AppError('Funcionário não encontrado', 404, 'NOT_FOUND');
    }
    return {
      fotoUrl: funcionario.foto
        ? await this.s3Service.gerarUrlPreAssinada(funcionario.foto)
        : null,
      arquivoUrl: funcionario.arquivo
        ? await this.s3Service.gerarUrlPreAssinada(funcionario.arquivo)
        : null,
    };
  }

  /**
   * Attach fresh presigned `fotoUrl` after cache reads so Redis can store
   * raw S3 keys without embedding expiring URLs.
   */
  private async withFotoUrls<T extends PaginatedResult<unknown>>(
    page: T,
  ): Promise<T> {
    const list = Array.isArray(page?.funcionarios) ? page.funcionarios : [];
    const funcionarios = await Promise.all(
      list.map(async (raw) => {
        const doc =
          raw && typeof (raw as { toObject?: () => unknown }).toObject === 'function'
            ? (raw as { toObject: () => Record<string, unknown> }).toObject()
            : { ...(raw as Record<string, unknown>) };
        const fotoKey =
          typeof doc.foto === 'string' && doc.foto && !/^https?:\/\//i.test(doc.foto)
            ? doc.foto
            : null;
        const fotoUrl = fotoKey
          ? await this.s3Service.gerarUrlPreAssinada(fotoKey)
          : typeof doc.fotoUrl === 'string'
            ? doc.fotoUrl
            : typeof doc.foto === 'string' && /^https?:\/\//i.test(doc.foto)
              ? doc.foto
              : null;
        return { ...doc, fotoUrl };
      }),
    );
    return { ...page, funcionarios };
  }

  /** IDs only, for select-all-filtered. */
  async buscarIds(
    {
      filters = {},
      setorIds = null,
      subtreeRoot = null,
      max = 10000,
    }: {
      filters?: ListFilters;
      setorIds?: string[] | null;
      subtreeRoot?: string | null;
      max?: number;
    } = {},
    tenantId: string | null = null,
  ) {
    const ids = await this.funcionariosRepository.findIdsOnly(filters, tenantId, {
      setorIds,
      subtreeRoot,
      max,
    });
    return { ids, total: ids.length };
  }

  async buscarFuncionariosPorCoordenadoria(
    idCoordenadoria: string,
    page = 1,
    limit = DEFAULT_LIST_LIMIT,
    tenantId: string | null = null,
    filters: ListFilters = {},
  ) {
    return this.buscarFuncionariosPorLotacao(
      idCoordenadoria,
      page,
      limit,
      tenantId,
      filters,
    );
  }

  async buscarFuncionariosPorLotacao(
    setorId: string,
    page = 1,
    limit = DEFAULT_LIST_LIMIT,
    tenantId: string | null = null,
    filters: ListFilters = {},
  ): Promise<PaginatedResult<unknown>> {
    const pageNum = clampPage(page);
    const limitNum = clampLimit(limit);
    const filterKey = hasActiveFilters(filters)
      ? `:f:${JSON.stringify(filters)}`
      : '';
    const cacheKey = `${tenantCachePrefix(tenantId)}setor:${setorId}:funcionarios:page:${pageNum}:l${limitNum}${filterKey}`;

    return this.withFotoUrls(
      await this.cacheService.getOrSetCache(cacheKey, async () => {
        const objectId = Types.ObjectId.isValid(setorId)
          ? new Types.ObjectId(setorId)
          : setorId;
        const skip = (pageNum - 1) * limitNum;

        const [total, funcionarios] = await Promise.all([
          this.funcionariosRepository.countBySetoresExact(
            [objectId],
            tenantId,
            filters,
          ),
          this.funcionariosRepository.findBySetoresFiltered(
            [objectId],
            skip,
            limitNum,
            tenantId,
            filters,
          ),
        ]);

        return {
          funcionarios,
          total,
          page: pageNum,
          pages: Math.max(1, Math.ceil(total / limitNum)),
        };
      }),
    );
  }

  async buscarFuncionariosPorSetor(
    idSetor: string,
    page = 1,
    limit = DEFAULT_LIST_LIMIT,
    tenantId: string | null = null,
    filters: ListFilters = {},
  ): Promise<PaginatedResult<unknown>> {
    const pageNum = clampPage(page);
    const limitNum = clampLimit(limit);
    const filterKey = hasActiveFilters(filters)
      ? `:f:${JSON.stringify(filters)}`
      : '';
    const objectId = Types.ObjectId.isValid(idSetor)
      ? new Types.ObjectId(idSetor)
      : idSetor;

    return this.withFotoUrls(
      await this.cacheService.getOrSetCache(
        `${tenantCachePrefix(tenantId)}setor:${idSetor}:subtree:page:${pageNum}:l${limitNum}${filterKey}`,
        async () => {
          const skip = (pageNum - 1) * limitNum;

          const [total, funcionarios] = await Promise.all([
            this.funcionariosRepository.countBySetor(objectId, tenantId, filters),
            this.funcionariosRepository.buscarFuncionariosPorSetor(
              objectId,
              skip,
              limitNum,
              tenantId,
              filters,
            ),
          ]);

          return {
            funcionarios,
            total,
            page: pageNum,
            pages: Math.max(1, Math.ceil(total / limitNum)),
          };
        },
      ),
    );
  }

  async buscarFuncionariosPorDivisoes(
    idsDivisoes: string[],
    page = 1,
    limit = DEFAULT_LIST_LIMIT,
    tenantId: string | null = null,
    filters: ListFilters = {},
  ) {
    return this.buscarFuncionariosPorSetores(idsDivisoes, page, limit, tenantId, filters);
  }

  async buscarFuncionariosPorSetores(
    idsSetores: string[],
    page = 1,
    limit = DEFAULT_LIST_LIMIT,
    tenantId: string | null = null,
    filters: ListFilters = {},
  ): Promise<PaginatedResult<unknown>> {
    const pageNum = clampPage(page);
    const limitNum = clampLimit(limit);
    const filterKey = hasActiveFilters(filters)
      ? `:f:${JSON.stringify(filters)}`
      : '';

    return this.withFotoUrls(
      await this.cacheService.getOrSetCache(
        `${tenantCachePrefix(tenantId)}setores:${idsSetores.join('-')}:page${pageNum}:l${limitNum}${filterKey}`,
        async () => {
          const skip = (pageNum - 1) * limitNum;

          const [total, funcionarios] = await Promise.all([
            this.funcionariosRepository.countBySetoresExact(
              idsSetores,
              tenantId,
              filters,
            ),
            this.funcionariosRepository.findBySetoresFiltered(
              idsSetores,
              skip,
              limitNum,
              tenantId,
              filters,
            ),
          ]);

          return {
            funcionarios,
            total,
            page: pageNum,
            pages: Math.max(1, Math.ceil(total / limitNum)),
          };
        },
      ),
    );
  }

  async exportCsv(tenantId: string | null = null, ids: string[] | null = null) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError(
        'Selecione ao menos um funcionário para exportar.',
        400,
        'BAD_REQUEST',
      );
    }

    const rows = await this.funcionariosRepository.findForExport(tenantId, ids);
    const header = ['nome', 'secretaria', 'funcao', 'natureza', 'referencia', 'salarioBruto'];
    const lines = [header.join(',')];

    for (const row of rows as Record<string, unknown>[]) {
      lines.push(
        [
          escapeCsv(row.nome),
          escapeCsv(row.secretaria),
          escapeCsv(row.funcao),
          escapeCsv(row.natureza),
          escapeCsv(row.referencia),
          escapeCsv(row.salarioBruto),
        ].join(','),
      );
    }

    return `\uFEFF${lines.join('\n')}`;
  }

  async createFuncionario(
    dto: FuncionarioDto,
    files: MulterFiles | undefined,
    tenantId: string | null,
    userId: string | null,
  ) {
    const fotoUrlAWS = files?.foto?.[0]
      ? await this.s3Service.uploadFile(files.foto[0], 'fotos', tenantId)
      : null;
    const arquivoUrlAWS = files?.arquivo?.[0]
      ? await this.s3Service.uploadFile(files.arquivo[0], 'arquivos', tenantId)
      : null;

    if (dto.natureza === 'COMISSIONADO') {
      const cargo = await this.cargoLookup.buscarPorNome(dto.funcao, tenantId);
      if (!cargo) {
        throw new AppError('Cargo comissionado não encontrado.', 400, 'BAD_REQUEST');
      }

      const simbologia = await this.cargoLookup.buscarPorSimbologia(
        cargo.simbologia,
        tenantId,
      );
      if (!simbologia) {
        throw new AppError('Simbologia não encontrada para o cargo.', 400, 'BAD_REQUEST');
      }
      if (simbologia.limite === 0) {
        throw new AppError(
          'Não é possível criar funcionário: limite atingido.',
          400,
          'BAD_REQUEST',
        );
      }

      await this.cargoLookup.updateLimite(
        simbologia.simbologia,
        simbologia.limite - 1,
        tenantId,
      );
    }

    const setorId = resolveSetorId(dto);
    if (!setorId) {
      throw new AppError('Lotação (setorId) obrigatória.', 400, 'BAD_REQUEST');
    }

    const { coordenadoria: _ignored, ...restBody } = dto;

    const funcionarioCriado = await this.funcionariosRepository.create({
      ...restBody,
      setorId: Types.ObjectId.isValid(setorId)
        ? new Types.ObjectId(setorId)
        : setorId,
      observacoes: normalizeObservacoes(
        (dto.observacoes || []) as ObservacaoInput[],
      ),
      foto: fotoUrlAWS,
      arquivo: arquivoUrlAWS,
      tenantId: tenantId
        ? Types.ObjectId.isValid(tenantId)
          ? new Types.ObjectId(tenantId)
          : tenantId
        : null,
      createdBy: userId
        ? Types.ObjectId.isValid(userId)
          ? new Types.ObjectId(userId)
          : userId
        : null,
    });

    const setor = await this.findSetorByIds([funcionarioCriado.setorId], tenantId);

    await this.cacheService.clearCacheForFuncionarios(
      tenantId,
      funcionarioCriado.setorId,
      setor[0]?.parent,
    );

    return {
      ...funcionarioCriado.toObject(),
      fotoUrl: fotoUrlAWS
        ? await this.s3Service.gerarUrlPreAssinada(fotoUrlAWS)
        : null,
      arquivoUrl: arquivoUrlAWS
        ? await this.s3Service.gerarUrlPreAssinada(arquivoUrlAWS)
        : null,
    };
  }

  async updateFuncionario(
    id: string,
    body: FuncionarioDto,
    files: MulterFiles | undefined,
    tenantId: string | null,
    updatedBy: string | null,
  ) {
    const funcionarioExistente = await this.funcionariosRepository.findByIds(
      id,
      tenantId,
    );
    if (!funcionarioExistente || funcionarioExistente.length === 0) {
      throw new AppError('Funcionário não encontrado', 404, 'NOT_FOUND');
    }

    const atual = funcionarioExistente[0] as Record<string, unknown> & {
      funcao: string;
      natureza: string;
      foto: string | null;
      arquivo: string | null;
    };

    const novaFuncao = body.funcao;
    const novaNatureza = body.natureza;

    if (novaFuncao !== atual.funcao) {
      await this.limiteService.atualizarLimitesDeFuncao(
        atual.funcao,
        novaFuncao,
        atual.natureza,
        novaNatureza,
        tenantId,
      );
    }

    const fotoUrlAWS = files?.foto?.[0]
      ? await this.s3Service.uploadFile(files.foto[0], 'fotos', tenantId)
      : atual.foto;

    const arquivoUrlAWS = files?.arquivo?.[0]
      ? await this.s3Service.uploadFile(files.arquivo[0], 'arquivos', tenantId)
      : atual.arquivo;

    const setorId = resolveSetorId(body) || lotacaoIdOf(atual as never);
    const { coordenadoria: _ignored, ...restBody } = body;

    const funcionarioAtualizado = await this.funcionariosRepository.update(
      id,
      {
        ...restBody,
        setorId,
        foto: fotoUrlAWS,
        arquivo: arquivoUrlAWS,
        updatedBy,
      },
      tenantId,
    );

    if (!funcionarioAtualizado) {
      throw new AppError('Funcionário não encontrado', 404, 'NOT_FOUND');
    }

    const setor = await this.findSetorByIds([funcionarioAtualizado.setorId], tenantId);

    await this.cacheService.clearCacheForFuncionarios(
      tenantId,
      funcionarioAtualizado.setorId,
      setor[0]?.parent,
    );

    return {
      status: 200,
      data: {
        ...funcionarioAtualizado.toObject(),
        fotoUrl: fotoUrlAWS
          ? await this.s3Service.gerarUrlPreAssinada(fotoUrlAWS)
          : null,
        arquivoUrl: arquivoUrlAWS
          ? await this.s3Service.gerarUrlPreAssinada(arquivoUrlAWS)
          : null,
      },
    };
  }

  async deleteUsers(userIds: string[], tenantId: string | null = null) {
    const setoresAfetados = new Set<string>();
    const cargosComissionados = new Map<string, number>();

    const batches: string[][] = [];
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      batches.push(userIds.slice(i, i + BATCH_SIZE));
    }

    await runWithConcurrency(batches, MAX_BATCH_CONCURRENCY, async (batch) => {
      const funcionarios = await this.funcionariosRepository.findByIds(
        batch,
        tenantId,
      );

      (funcionarios as Record<string, unknown>[]).forEach((func) => {
        const lotacao = lotacaoIdOf(func as never);
        if (lotacao) {
          setoresAfetados.add(String(lotacao));
        }

        if (func.natureza === 'COMISSIONADO' && func.funcao) {
          const atual = cargosComissionados.get(String(func.funcao)) || 0;
          cargosComissionados.set(String(func.funcao), atual + 1);
        }
      });

      return this.funcionariosRepository.deleteBatch(batch, tenantId);
    });

    for (const [nomeFuncao, qtd] of cargosComissionados) {
      const cargo = await this.cargoLookup.buscarPorNome(nomeFuncao, tenantId);
      if (cargo && cargo.simbologia) {
        const simbologiaAtual = await this.cargoLookup.buscarPorSimbologia(
          cargo.simbologia,
          tenantId,
        );
        const novoLimite = (simbologiaAtual?.limite || 0) + qtd;
        await this.cargoLookup.updateLimite(cargo.simbologia, novoLimite, tenantId);
      }
    }

    const setoresAfetadosArray = Array.from(setoresAfetados);
    const setores = await this.findSetorByIds(setoresAfetadosArray, tenantId);

    const setoresParaLimparCache: unknown[] = [...setoresAfetadosArray];
    setores.forEach((setor) => {
      if (setor.parent) {
        setoresParaLimparCache.push(setor.parent);
      }
    });

    await this.cacheService.clearCacheForFuncionarios(
      tenantId,
      ...setoresParaLimparCache,
    );

    return { success: true, deleted: userIds.length };
  }

  async updateLotacao(
    userIds: string[],
    newSetorId: string,
    tenantId: string | null = null,
  ) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError('Lista de usuários inválida.', 400, 'BAD_REQUEST');
    }
    if (!newSetorId) {
      throw new AppError('Setor de destino obrigatório.', 400, 'BAD_REQUEST');
    }

    const users = await this.funcionariosRepository.findByIds(userIds, tenantId);
    if (!users.length) {
      throw new AppError('Nenhum funcionário encontrado.', 404, 'NOT_FOUND');
    }

    const oldSetorIds = (users as Record<string, unknown>[])
      .map((u) => {
        const lotacao = lotacaoIdOf(u as never);
        return lotacao ? String(lotacao) : null;
      })
      .filter((id): id is string => id !== null);

    const oldSetores = await this.findSetorByIds(oldSetorIds, tenantId);
    const parentIds = oldSetores.map((c) => c.parent).filter(Boolean);

    await this.funcionariosRepository.updateSetorId(userIds, newSetorId, tenantId);

    await this.cacheService.clearCacheForCoordChange(
      tenantId,
      oldSetorIds,
      newSetorId,
      parentIds,
    );

    return this.funcionariosRepository.findByIds(userIds, tenantId);
  }

  async updateObservacoes(
    userId: string,
    observacoes: unknown[],
    tenantId: string | null = null,
  ) {
    const user = await this.funcionariosRepository.findByIds(userId, tenantId);

    if (!user || !user.length) {
      throw new AppError('Usuário não encontrado.', 404, 'NOT_FOUND');
    }

    const normalized = normalizeObservacoes(
      observacoes as ObservacaoInput[],
      { assignMissingDate: true },
    );

    const updatedFuncionario = await this.funcionariosRepository.updateObservacoes(
      userId,
      normalized,
      tenantId,
    );

    if (!updatedFuncionario) {
      throw new AppError('Usuário não encontrado.', 404, 'NOT_FOUND');
    }

    const lotacao = lotacaoIdOf(updatedFuncionario as never);
    const setor = await this.findSetorByIds([lotacao], tenantId);

    await this.cacheService.clearCacheForFuncionarios(
      tenantId,
      lotacao,
      setor[0]?.parent,
    );

    return updatedFuncionario;
  }

  async checkNameAvailability(name: string | undefined, tenantId: string | null = null) {
    if (!name || name.trim().length < 3) {
      return {
        available: true,
        message: 'Digite pelo menos 3 caracteres',
        statusCode: 400,
      };
    }

    const normalizedName = normalizarTexto(name);

    const existingFuncionario = await this.funcionariosRepository.findByName(
      String(normalizedName),
      tenantId,
    );

    if (existingFuncionario) {
      return {
        available: false,
        message: 'Já existe um funcionário ativo com este nome',
        statusCode: 200,
      };
    }

    return {
      available: true,
      message: 'Nome disponível',
      statusCode: 200,
    };
  }

  async hasFuncionarios(entityId: string) {
    const entity = await this.setorModel.findById(entityId);
    if (!entity) {
      throw new AppError('Entidade não encontrada', 404, 'NOT_FOUND');
    }

    const count = await this.funcionariosRepository.countBySetor(entityId);
    return count > 0;
  }
}

export { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT };
