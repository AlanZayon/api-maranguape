const SetorService = require('../services/SetorService');

function resolveTenantId(req) {
  return req.user?.tenantId || req.tenantId || null;
}

class SetorController {
  static async createSetor(req, res, next) {
    try {
      const result = await SetorService.createSetor(
        req.body,
        resolveTenantId(req),
        req.user?.id
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getSetoresOrganizados(req, res, next) {
    try {
      const setores = await SetorService.getSetoresOrganizados(
        resolveTenantId(req)
      );
      res.json({ setores });
    } catch (err) {
      next(err);
    }
  }

  static async getMainSetores(req, res, next) {
    try {
      const setores = await SetorService.getMainSetores(resolveTenantId(req));
      res.json({ setores });
    } catch (err) {
      next(err);
    }
  }

  static async getSetorData(req, res, next) {
    try {
      const { setorId } = req.params;
      const data = await SetorService.getSetorData(
        setorId,
        resolveTenantId(req)
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  static async renameSetor(req, res, next) {
    try {
      const { id } = req.params;
      const { nome } = req.body;
      const result = await SetorService.renameSetor(id, nome, req.user?.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async moveSetor(req, res, next) {
    try {
      const { id } = req.params;
      const { parent } = req.body;
      const result = await SetorService.moveSetor(id, parent, {
        tenantId: resolveTenantId(req),
        userId: req.user?.id,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async deleteSetor(req, res, next) {
    try {
      const { id } = req.params;
      await SetorService.deleteSetor(id, {
        tenantId: resolveTenantId(req),
        userId: req.user?.id,
      });
      res
        .status(200)
        .json({ message: 'Setor e seus filhos deletados com sucesso' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SetorController;
