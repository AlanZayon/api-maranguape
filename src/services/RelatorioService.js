const PDFDocument = require('pdfkit');
const path = require('path');
const FuncionarioRepository = require('../repositories/FuncionariosRepository');

class RelatorioService {
  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margins: { top: 100, left: 50, right: 50, bottom: 50 },
    });
  }

  async gerarRelatorioPDF(ids) {
    const logoPath = path.join(__dirname, '../../images/link65.png');
    this.doc.image(logoPath, 200, 10, { width: 100 }).moveDown(2);

    const funcionarios = await FuncionarioRepository.findByIds(ids);
    const totalFuncionarios = await FuncionarioRepository.contarTotal();

    if (funcionarios.length === 1) {
      this.preencherRelatorioIndividual(funcionarios[0]);
    } else {
      await this.preencherRelatorioGeral(funcionarios, totalFuncionarios);
    }

    return this.doc;
  }

  preencherRelatorioIndividual(funcionario) {
    this.doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#333333')
      .text('Relatório Individual', { align: 'center' })
      .moveDown(2);
    this.doc
      .fontSize(14)
      .fillColor('#555555')
      .text(`Nome: ${funcionario.nome}`)
      .text(`Secretaria: ${funcionario.secretaria}`)
      .text(`Função: ${funcionario.funcao}`)
      .text(`Natureza: ${funcionario.natureza}`)
      .text(`Referência: ${funcionario.referencia}`)
      .text(`Salário Bruto: R$ ${funcionario.salarioBruto.toFixed(2)}`)
      .text(`Salário Líquido: R$ ${funcionario.salarioLiquido.toFixed(2)}`)
      .text(`Endereço: ${funcionario.endereco}`)
      .text(`Bairro: ${funcionario.bairro}`)
      .text(`Telefone: ${funcionario.telefone}`);
  }

  async preencherRelatorioGeral(funcionarios, totalFuncionarios) {
    this.doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#333333')
      .text('Relatório de Funcionários', { align: 'center' })
      .moveDown(2);

    const {
      mediaSalarioBruto,
      mediaSalarioLiquido,
      totalReferencias,
      totalBairros,
    } = RelatorioService.calcularEstatisticas(funcionarios);
    const referenciasEmpresa =
      await FuncionarioRepository.agruparPorReferencia();

    this.doc
      .fontSize(14)
      .fillColor('#333333')
      .text('Referências', { underline: true })
      .moveDown();
    for (const [ref, qtd] of Object.entries(totalReferencias)) {
      const totalRefEmpresa =
        referenciasEmpresa.find((r) => r._id === ref)?.total || 0;
      const percentEmpresa = (
        (totalRefEmpresa / totalFuncionarios) *
        100
      ).toFixed(2);
      const percentRequisicao = ((qtd / funcionarios.length) * 100).toFixed(2);
      this.doc
        .fontSize(12)
        .fillColor('#555555')
        .text(
          `${ref}: Total dos enviados ${qtd} (${percentRequisicao}% dos enviados, ${percentEmpresa}% da empresa)`
        );
    }
    this.doc.moveDown();

    this.doc
      .fontSize(14)
      .fillColor('#333333')
      .text('Média Salarial', { underline: true })
      .moveDown();
    this.doc
      .fontSize(12)
      .fillColor('#555555')
      .text(`Média Salário Bruto: R$ ${mediaSalarioBruto.toFixed(2)}`)
      .text(`Média Salário Líquido: R$ ${mediaSalarioLiquido.toFixed(2)}`);
    this.doc.moveDown();

    this.doc
      .fontSize(14)
      .fillColor('#333333')
      .text('Distribuição por Bairros', { underline: true })
      .moveDown();
    for (const [bairro, qtd] of Object.entries(totalBairros)) {
      const percentBairro = ((qtd / funcionarios.length) * 100).toFixed(2);
      this.doc
        .fontSize(12)
        .fillColor('#555555')
        .text(`${bairro}: ${qtd} (${percentBairro}%)`);
    }
  }

  static calcularEstatisticas(funcionarios) {
    const totalSalarioBruto = funcionarios.reduce(
      (sum, f) => sum + f.salarioBruto,
      0
    );
    const totalSalarioLiquido = funcionarios.reduce(
      (sum, f) => sum + f.salarioLiquido,
      0
    );
    const mediaSalarioBruto = totalSalarioBruto / funcionarios.length;
    const mediaSalarioLiquido = totalSalarioLiquido / funcionarios.length;

    const totalReferencias = funcionarios.reduce((acc, f) => {
      acc[f.referencia] = (acc[f.referencia] || 0) + 1;
      return acc;
    }, {});

    const totalBairros = funcionarios.reduce((acc, f) => {
      acc[f.bairro] = (acc[f.bairro] || 0) + 1;
      return acc;
    }, {});

    return {
      mediaSalarioBruto,
      mediaSalarioLiquido,
      totalReferencias,
      totalBairros,
    };
  }
}

module.exports = new RelatorioService();
