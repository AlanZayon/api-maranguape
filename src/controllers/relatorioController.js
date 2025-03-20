const RelatorioService = require('../services/RelatorioService');

class RelatorioController {
  static async gerarRelatorio(req, res) {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ error: 'Envie uma lista de IDs válida.' });
      }

      const pdfStream = await RelatorioService.gerarRelatorioPDF(ids);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=relatorio.pdf'
      );
      pdfStream.pipe(res);
      pdfStream.end();
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}

module.exports = RelatorioController;
