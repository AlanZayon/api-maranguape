const XLSX = require('xlsx');
const CargoComissionadoRepository = require('../repositories/cargoComissionadoRepository');
const CacheService = require('../services/CacheService');
const AppError = require('../utils/AppError');
const { normalizarTexto } = require('../validations/validateCargoComissionado');
const redisClient = require('../config/redisClient');

class CargoComissionadoService {
  static async invalidateCache() {
    await redisClient.del('todos:cargosComissionados');
  }

  static async listarCargos() {
    return await CacheService.getOrSetCache(
      `todos:cargosComissionados`,
      async () => {
        return await CargoComissionadoRepository.buscarTodos();
      }
    );
  }

  static async garantirSimbologia({
    simbologia,
    limite,
    tenantId,
    userId,
  }) {
    const existing = await CargoComissionadoRepository.buscarPorSimbologia(
      simbologia
    );

    if (!existing && (limite === undefined || limite === null)) {
      throw new AppError(
        `Simbologia "${simbologia}" não existe. Informe o limite para criá-la.`,
        400,
        'SIMBOLOGIA_REQUIRED'
      );
    }

    const result = await CargoComissionadoRepository.upsertSimbologia({
      simbologia,
      limite: limite !== undefined && limite !== null ? Number(limite) : undefined,
      tenantId,
      userId,
    });

    if (!result) {
      throw new AppError(
        `Não foi possível criar a simbologia "${simbologia}".`,
        400,
        'SIMBOLOGIA_CREATE_FAILED'
      );
    }

    return result;
  }

  static async criar(payload, { tenantId = null, userId = null } = {}) {
    const tipo = normalizarTexto(payload.tipo);
    const cargo = normalizarTexto(payload.cargo);
    const simbologia = normalizarTexto(payload.simbologia);
    const aDefinir = Number(payload.aDefinir);
    const limite =
      payload.limite !== undefined && payload.limite !== null
        ? Number(payload.limite)
        : undefined;

    const existente = await CargoComissionadoRepository.buscarPorNome(cargo);
    if (existente) {
      throw new AppError(
        `Já existe um cargo comissionado com o nome "${cargo}".`,
        400,
        'CARGO_DUPLICATE'
      );
    }

    await this.garantirSimbologia({ simbologia, limite, tenantId, userId });

    const created = await CargoComissionadoRepository.criar({
      tipo,
      cargo,
      simbologia,
      aDefinir,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    await this.invalidateCache();
    return created;
  }

  static async atualizar(id, payload, { tenantId = null, userId = null } = {}) {
    const atual = await CargoComissionadoRepository.buscarPorId(id);
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
      const conflito = await CargoComissionadoRepository.buscarPorNome(cargo);
      if (conflito && String(conflito._id) !== String(id)) {
        throw new AppError(
          `Já existe um cargo comissionado com o nome "${cargo}".`,
          400,
          'CARGO_DUPLICATE'
        );
      }
    }

    await this.garantirSimbologia({ simbologia, limite, tenantId, userId });

    const updated = await CargoComissionadoRepository.atualizar(id, {
      tipo,
      cargo,
      simbologia,
      aDefinir,
      updatedBy: userId,
    });

    await this.invalidateCache();
    return updated;
  }

  static async remover(id) {
    const atual = await CargoComissionadoRepository.buscarPorId(id);
    if (!atual) {
      throw new AppError('Cargo comissionado não encontrado.', 404, 'NOT_FOUND');
    }

    await CargoComissionadoRepository.remover(id);
    await this.invalidateCache();
    return { message: 'Cargo comissionado removido com sucesso.' };
  }

  static gerarTemplateBuffer() {
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
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  static async importarPlanilha(buffer, { tenantId = null, userId = null } = {}) {
    if (!buffer || !buffer.length) {
      throw new AppError('Arquivo inválido ou vazio.', 400, 'INVALID_FILE');
    }

    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch {
      throw new AppError(
        'Não foi possível ler o arquivo. Envie um .xlsx válido.',
        400,
        'INVALID_XLSX'
      );
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new AppError('Planilha sem abas.', 400, 'EMPTY_SHEET');
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: '',
      raw: false,
    });

    if (!rows.length) {
      throw new AppError('Planilha sem dados.', 400, 'EMPTY_DATA');
    }

    const created = [];
    const updated = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const raw = rows[i];

      try {
        const tipo = normalizarTexto(String(raw.tipo ?? raw.Tipo ?? '').trim());
        const cargo = normalizarTexto(String(raw.cargo ?? raw.Cargo ?? '').trim());
        const simbologia = normalizarTexto(
          String(raw.simbologia ?? raw.Simbologia ?? '').trim()
        );
        const aDefinirRaw = raw.aDefinir ?? raw.ADefinir ?? raw['a definir'] ?? '';
        const limiteRaw = raw.limite ?? raw.Limite ?? '';

        if (!tipo || !cargo || !simbologia || aDefinirRaw === '') {
          throw new Error(
            'Colunas obrigatórias: tipo, cargo, simbologia, aDefinir.'
          );
        }

        const aDefinir = Number(
          String(aDefinirRaw).replace(/\./g, '').replace(',', '.')
        );
        if (Number.isNaN(aDefinir)) {
          throw new Error('aDefinir deve ser numérico.');
        }

        let limite;
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

        const existente = await CargoComissionadoRepository.buscarPorNome(cargo);
        if (existente) {
          await CargoComissionadoRepository.atualizar(existente._id, {
            tipo,
            cargo,
            simbologia,
            aDefinir,
            updatedBy: userId,
          });
          updated.push({ row: rowNumber, cargo });
        } else {
          await CargoComissionadoRepository.criar({
            tipo,
            cargo,
            simbologia,
            aDefinir,
            tenantId,
            createdBy: userId,
            updatedBy: userId,
          });
          created.push({ row: rowNumber, cargo });
        }
      } catch (err) {
        errors.push({
          row: rowNumber,
          message: err.message || 'Erro ao processar linha.',
        });
      }
    }

    await this.invalidateCache();

    return {
      created: created.length,
      updated: updated.length,
      errors,
      details: { created, updated },
    };
  }
}

module.exports = CargoComissionadoService;
