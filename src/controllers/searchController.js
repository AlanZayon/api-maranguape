const SearchService = require('../services/searchService');

class SearchController {
  static async autocomplete(req, res) {
    try {
      const termo = req.query.q;
      const resultados = await SearchService.autocomplete(termo);
      res.json(resultados);
    } catch (error) {
      console.error(error);
      const status = error.message.includes('Termo') ? 400 : 500;
      res.status(status).json({ error: error.message });
    }
  }

  static async searchFuncionarios(req, res) {
    try {
      const { q } = req.query;
      const resultados = await SearchService.searchFuncionarios(q);
      res.json(resultados);
    } catch (error) {
      console.error(error);
      const status = error.message.includes('obrigatório') ? 400 : 500;
      res.status(status).json({ error: error.message });
    }
  }
}

module.exports = SearchController;