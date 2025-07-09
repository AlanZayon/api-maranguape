const RelatorioService = require('../services/RelatorioService');

class RelatorioController {
  static async gerarRelatorio(req, res) {
    try {
      const { ids, tipo } = req.body;

      console.log('Parâmetros recebidos:', { ids, tipo });
      
      if (ids && !Array.isArray(ids)) {
        return res.status(400).json({ error: 'O parâmetro "ids" deve ser um array.' });
      }
      
      if (tipo && !['geral','salarial', 'referencias', 'localidade'].includes(tipo)) {
        return res.status(400).json({ 
          error: 'Tipo de relatório inválido. Opções válidas: salarial, referencias, localidade' 
        });
      }

      const pdfBuffer = await RelatorioService.gerarRelatorioPDF(ids || [], tipo, false);
      
      const nomeArquivo = RelatorioController.gerarNomeArquivo(tipo);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}`);
      
      res.send(pdfBuffer);

    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      res.status(500).json({ 
        error: 'Erro interno no servidor.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }

  static gerarNomeArquivo(tipo) {
    const data = new Date();
    const dataFormatada = data.toISOString().split('T')[0];
    const prefixos = {
      salarial: 'relatorio_salarial',
      referencias: 'relatorio_referencias',
      localidade: 'relatorio_localidade',
      default: 'relatorio_funcionarios'
    };
    return `${prefixos[tipo] || prefixos.default}_${dataFormatada}.pdf`;
  }
}

module.exports = RelatorioController;