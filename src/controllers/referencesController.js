const ReferencesService = require('../services/referencesService');

class ReferencesController {
  static async registerReference(req, res) {
    try {
      await ReferencesService.registerReference(req.body);
      res.status(201).json({ message: 'Referência registrada com sucesso!' });
    } catch (error) {
      console.error('Erro ao registrar referência:', error.message);
      const status = error.message.includes('obrigatór') ? 400 : 
                    error.message.includes('existe') ? 400 : 500;
      res.status(status).json({ message: error.message });
    }
  }

  static async getReferences(req, res) {
    try {
      const references = await ReferencesService.getReferences();
      res.json({ referencias: references });
    } catch (error) {
      console.error('Erro ao obter referências:', error.message);
      res.status(500).json({ message: 'Erro ao obter referências!' });
    }
  }

  static async deleteReference(req, res) {
    try {
      await ReferencesService.deleteReference(req.params.id);
      res.status(200).json({ message: 'Referência deletada com sucesso!' });
    } catch (error) {
      console.error('Erro ao deletar referência:', error.message);
      const status = error.message.includes('encontrada') ? 404 : 500;
      res.status(status).json({ message: error.message });
    }
  }
}

module.exports = ReferencesController;