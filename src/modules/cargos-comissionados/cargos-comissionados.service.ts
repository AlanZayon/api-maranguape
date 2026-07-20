import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { CargosComissionadosRepository } from './cargos-comissionados.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { AppError } from '../../common/errors/app-error';
import { normalizarTexto } from '../../common/utils/normalizar-texto';
import { cacheKey } from '../../common/utils/tenant.helpers';
import { CreateCargoComissionadoDto } from './dto/create-cargo-comissionado.dto';

export type CargoAuditContext = {
  tenantId?: string | null;
  userId?: string | null;
};

@Injectable()
export class CargosComissionadosService {
  constructor(
    private readonly cargosRepository: CargosComissionadosRepository,
    private readonly cacheService: CacheService,
  ) {}

  private async invalidateCache(tenantId: string | null = null) {
    await this.cacheService.bumpVersion(tenantId);
  }

  async listarCargos(tenantId: string | null = null) {
    return this.cacheService.getOrSetCache(
      cacheKey(tenantId, 'todos:cargosComissionados'),
      async () => this.cargosRepository.buscarTodos(tenantId),
    );
  }

  async garantirSimbologia({
    simbologia,
    limite,
    tenantId,
    userId,
  }: {
    simbologia: string;
    limite?: number | null;
    tenantId?: string | null;
    userId?: string | null;
  }) {
    const existing = await this.cargosRepository.buscarPorSimbologia(
      simbologia,
      tenantId,
    );

    if (!existing && (limite === undefined || limite === null)) {
      throw new AppError(
        `Simbologia "${simbologia}" não existe. Informe o limite para criá-la.`,
        400,
        'SIMBOLOGIA_REQUIRED',
      );
    }

    const result = await this.cargosRepository.upsertSimbologia({
      simbologia,
      limite:
        limite !== undefined && limite !== null ? Number(limite) : undefined,
      tenantId,
      userId,
    });

    if (!result) {
      throw new AppError(
        `Não foi possível criar a simbologia "${simbologia}".`,
        400,
        'SIMBOLOGIA_CREATE_FAILED',
      );
    }

    return result;
  }

  async criar(
    payload: CreateCargoComissionadoDto,
    { tenantId = null, userId = null }: CargoAuditContext = {},
  ) {
    const tipo = normalizarTexto(payload.tipo);
    const cargo = normalizarTexto(payload.cargo);
    const simbologia = normalizarTexto(payload.simbologia);
    const aDefinir = Number(payload.aDefinir);
    const limite =
      payload.limite !== undefined && payload.limite !== null
        ? Number(payload.limite)
        : undefined;

    const existente = await this.cargosRepository.buscarPorNome(
      cargo,
      tenantId,
    );
    if (existente) {
      throw new AppError(
        `Já existe um cargo comissionado com o nome "${cargo}".`,
        400,
        'CARGO_DUPLICATE',
      );
    }

    await this.garantirSimbologia({ simbologia, limite, tenantId, userId });

    const created = await this.cargosRepository.criar({
      tipo,
      cargo,
      simbologia,
      aDefinir,
      tenantId: tenantId as never,
      createdBy: userId as never,
      updatedBy: userId as never,
    });

    await this.invalidateCache(tenantId);
    return created;
  }

  async atualizar(
    id: string,
    payload: CreateCargoComissionadoDto,
    { tenantId = null, userId = null }: CargoAuditContext = {},
  ) {
    const atual = await this.cargosRepository.buscarPorId(id, tenantId);
    if (!atual) {
      throw new AppError('Cargo comissionado não encontrado.', 404, 'NOT_FOUND');
    }

    const tipo = normalizarTexto(payload.tipo);
    const cargo = normalizarTexto(payload.cargo);
    const simbologia = normalizarTexto(payload.simbologia);
    const aDefinir = Number(payload.aDefinir);
    const limite =
      payload.limite !== undefined && payload.limite !== null
        ? Number(payload.limite)
        : undefined;

    if (cargo !== atual.cargo) {
      const conflito = await this.cargosRepository.buscarPorNome(
        cargo,
        tenantId,
      );
      if (conflito && String(conflito._id) !== String(id)) {
        throw new AppError(
          `Já existe um cargo comissionado com o nome "${cargo}".`,
          400,
          'CARGO_DUPLICATE',
        );
      }
    }

    await this.garantirSimbologia({ simbologia, limite, tenantId, userId });

    const updated = await this.cargosRepository.atualizar(
      id,
      {
        tipo,
        cargo,
        simbologia,
        aDefinir,
        updatedBy: userId as never,
      },
      tenantId,
    );

    await this.invalidateCache(tenantId);
    return updated;
  }

  async remover(id: string, { tenantId = null }: CargoAuditContext = {}) {
    const atual = await this.cargosRepository.buscarPorId(id, tenantId);
    if (!atual) {
      throw new AppError('Cargo comissionado não encontrado.', 404, 'NOT_FOUND');
    }

    await this.cargosRepository.remover(id, tenantId);
    await this.invalidateCache(tenantId);
    return { message: 'Cargo comissionado removido com sucesso.' };
  }

  gerarTemplateBuffer(): Buffer {
    const rows = [
      {
        tipo: 'DAS',
        cargo: 'ASSESSOR ESPECIAL',
        simbologia: 'DAS-1',
        aDefinir: 5000,
        limite: 10,
      },
    ];
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Cargos');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async importarPlanilha(
    buffer: Buffer,
    { tenantId = null, userId = null }: CargoAuditContext = {},
  ) {
    if (!buffer || !buffer.length) {
      throw new AppError('Arquivo inválido ou vazio.', 400, 'INVALID_FILE');
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch {
      throw new AppError(
        'Não foi possível ler o arquivo. Envie um .xlsx válido.',
        400,
        'INVALID_XLSX',
      );
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new AppError('Planilha sem abas.', 400, 'EMPTY_SHEET');
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[sheetName],
      { defval: '', raw: false },
    );

    if (!rows.length) {
      throw new AppError('Planilha sem dados.', 400, 'EMPTY_DATA');
    }

    const created: { row: number; cargo: string }[] = [];
    const updated: { row: number; cargo: string }[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const raw = rows[i];

      try {
        const tipo = normalizarTexto(
          String(raw.tipo ?? raw.Tipo ?? '').trim(),
        );
        const cargo = normalizarTexto(
          String(raw.cargo ?? raw.Cargo ?? '').trim(),
        );
        const simbologia = normalizarTexto(
          String(raw.simbologia ?? raw.Simbologia ?? '').trim(),
        );
        const aDefinirRaw =
          raw.aDefinir ?? raw.ADefinir ?? raw['a definir'] ?? '';
        const limiteRaw = raw.limite ?? raw.Limite ?? '';

        if (!tipo || !cargo || !simbologia || aDefinirRaw === '') {
          throw new Error(
            'Colunas obrigatórias: tipo, cargo, simbologia, aDefinir.',
          );
        }

        const aDefinir = Number(
          String(aDefinirRaw).replace(/\./g, '').replace(',', '.'),
        );
        if (Number.isNaN(aDefinir)) {
          throw new Error('aDefinir deve ser numérico.');
        }

        let limite: number | undefined;
        if (limiteRaw !== '' && limiteRaw !== null && limiteRaw !== undefined) {
          limite = Number(String(limiteRaw).replace(/\./g, '').replace(',', '.'));
          if (Number.isNaN(limite) || limite < 0) {
            throw new Error('limite deve ser um número >= 0.');
          }
        }

        await this.garantirSimbologia({
          simbologia,
          limite,
          tenantId,
          userId,
        });

        const existente = await this.cargosRepository.buscarPorNome(
          cargo,
          tenantId,
        );
        if (existente) {
          await this.cargosRepository.atualizar(
            String(existente._id),
            {
              tipo,
              cargo,
              simbologia,
              aDefinir,
              updatedBy: userId as never,
            },
            tenantId,
          );
          updated.push({ row: rowNumber, cargo });
        } else {
          await this.cargosRepository.criar({
            tipo,
            cargo,
            simbologia,
            aDefinir,
            tenantId: tenantId as never,
            createdBy: userId as never,
            updatedBy: userId as never,
          });
          created.push({ row: rowNumber, cargo });
        }
      } catch (err) {
        errors.push({
          row: rowNumber,
          message: (err as Error).message || 'Erro ao processar linha.',
        });
      }
    }

    await this.invalidateCache(tenantId);

    return {
      created: created.length,
      updated: updated.length,
      errors,
      details: { created, updated },
    };
  }
}
