const CargoComissionadoService = require('../services/cargoComissionadoService');

function resolveTenantId(req) {
  return req.user?.tenantId || req.tenantId || null;
}

function resolveUserId(req) {
  return req.user?.id || null;
}

class CargoComissionadoController {
  static async listar(req, res, next) {
    try {
      const cargos = await CargoComissionadoService.listarCargos(
        resolveTenantId(req)
      );
      res.status(200).json(cargos);
    } catch (err) {
      next(err);
    }
  }

  static async criar(req, res, next) {
    try {
      const cargo = await CargoComissionadoService.criar(req.body, {
        tenantId: resolveTenantId(req),
        userId: resolveUserId(req),
      });
      res.status(201).json(cargo);
    } catch (err) {
      next(err);
    }
  }

  static async atualizar(req, res, next) {
    try {
      const cargo = await CargoComissionadoService.atualizar(
        req.params.id,
        req.body,
        {
          tenantId: resolveTenantId(req),
          userId: resolveUserId(req),
        }
      );
      res.status(200).json(cargo);
    } catch (err) {
      next(err);
    }
  }

  static async remover(req, res, next) {
    try {
      const result = await CargoComissionadoService.remover(req.params.id, {
        tenantId: resolveTenantId(req),
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async importar(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: 'Envie um arquivo .xlsx no campo file.' });
      }

      const result = await CargoComissionadoService.importarPlanilha(file.buffer, {
        tenantId: resolveTenantId(req),
        userId: resolveUserId(req),
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async template(req, res, next) {
    try {
      const buffer = CargoComissionadoService.gerarTemplateBuffer();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="modelo-cargos-comissionados.xlsx"'
      );
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CargoComissionadoController;
