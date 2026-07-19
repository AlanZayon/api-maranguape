const ReferencesService = require('../services/referencesService');

function resolveTenantId(req) {
  return req.user?.tenantId || req.tenantId || null;
}

class ReferencesController {
  static async registerReference(req, res) {
    try {
      await ReferencesService.registerReference(
        req.body,
        resolveTenantId(req),
        req.user?.id || null
      );
      res.status(201).json({ message: 'Referência registrada com sucesso!' });
    } catch (error) {
      console.error('Erro ao registrar referência:', error.message);
      const status =
        error.message.includes('obrigatór') ||
        error.message.includes('existe') ||
        error.message.includes('já está cadastrado') ||
        error.message.includes('não encontrado') ||
        error.message.includes('sem nome')
          ? 400
          : 500;
      res.status(status).json({ message: error.message });
    }
  }

  static async getReferences(req, res) {
    try {
      const references = await ReferencesService.getReferences(
        resolveTenantId(req)
      );
      res.json({ referencias: references });
    } catch (error) {
      console.error('Erro ao obter referências:', error.message);
      res.status(500).json({ message: 'Erro ao obter referências!' });
    }
  }

  static async deleteReference(req, res) {
    try {
      await ReferencesService.deleteReference(
        req.params.id,
        resolveTenantId(req)
      );
      res.status(200).json({ message: 'Referência deletada com sucesso!' });
    } catch (error) {
      console.error('Erro ao deletar referência:', error.message);
      const status = error.message.includes('encontrada') ? 404 : 500;
      res.status(status).json({ message: error.message });
    }
  }
}

module.exports = ReferencesController;
