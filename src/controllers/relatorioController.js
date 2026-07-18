const RelatorioService = require('../services/RelatorioService');

class RelatorioController {
  static async obterDados(req, res) {
    try {
      const { ids, tipo } = req.body;

      if (ids && !Array.isArray(ids)) {
        return res.status(400).json({ error: 'O parâmetro "ids" deve ser um array.' });
      }

      const tipoRelatorio = tipo || 'geral';
      const dados = await RelatorioService.obterDadosRelatorio(ids || [], tipoRelatorio);
      return res.json(dados);
    } catch (err) {
      console.error('Erro ao obter dados do relatório:', err);
      const status = err.status || 500;
      return res.status(status).json({
        error: status === 500 ? 'Erro interno no servidor.' : err.message,
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    }
  }
}

module.exports = RelatorioController;
