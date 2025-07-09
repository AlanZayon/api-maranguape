const PDFDocument = require('pdfkit');
const path = require('path');
const { Transform } = require('stream');
const FuncionarioRepository = require('../repositories/FuncionariosRepository');

class RelatorioService {
  constructor() {
    this.styles = {
      title: { font: 'Helvetica-Bold', size: 18, color: '#222222' },
      header: { font: 'Helvetica-Bold', size: 16, color: '#115488' },
      subheader: { font: 'Helvetica-Bold', size: 14, color: '#115488', underline: true },
      body: { font: 'Helvetica', size: 12, color: '#333333' },
      footer: { font: 'Helvetica', size: 10, color: '#777777' },
      error: { font: 'Helvetica', size: 12, color: '#FF0000' },
      highlight: { font: 'Helvetica-Bold', size: 12, color: '#115488' }
    };
  }

  createDocument() {
    return new PDFDocument({
      size: 'A4',
      margins: { top: 100, left: 50, right: 50, bottom: 50 },
      bufferPages: true,
      info: {
        Title: 'Relatório de Funcionários',
        Author: 'Prefeitura Municipal',
        Creator: 'Sistema de Gestão de Pessoal'
      }
    });
  }

  formatarReais(valor) {
    const valorNumerico = typeof valor === 'number' && !isNaN(valor) ? valor : 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valorNumerico);
  }


  applyStyle(doc, style, options = {}) {
    doc.font(style.font)
       .fontSize(style.size)
       .fillColor(style.color);
    
    if (style.underline && options.text) {
      doc.text(options.text, { underline: true });
    }
    
    return doc;
  }

  validateFuncionarioData(funcionario) {
    const requiredFields = ['nome', 'secretaria', 'funcao', 'natureza', 'salarioBruto'];
    const missingFields = [];
    
    requiredFields.forEach(field => {
      if (!funcionario[field] && funcionario[field] !== 0) {
        missingFields.push(field);
      }
    });

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  async gerarRelatorioPDF(ids, tipoRelatorio, streamOutput = false) {
    const doc = this.createDocument();
    
    try {
      await this.configurarCabecalho(doc, this.obterTituloRelatorio(tipoRelatorio));

      const funcionarios = ids && ids.length > 0
        ? await FuncionarioRepository.findByIds(ids)
        : await FuncionarioRepository.findAll();

      if (funcionarios.length === 0) {
        this.applyStyle(doc, this.styles.error)
          .text('Nenhum funcionário encontrado para os critérios selecionados.', { align: 'center' });
        
        this.adicionarRodape(doc);
        return streamOutput ? doc : this.finalizeDocument(doc);
      }

      const validationResults = funcionarios.map(f => this.validateFuncionarioData(f));
      const invalidFuncionarios = validationResults.filter(r => !r.isValid);
      
      if (invalidFuncionarios.length > 0) {
        console.warn('Dados incompletos encontrados:', invalidFuncionarios);
        this.applyStyle(doc, this.styles.error)
          .text('Alguns funcionários possuem dados incompletos. O relatório pode estar parcial.', { align: 'center' })
          .moveDown(1);
      }

      switch (tipoRelatorio) {
        case 'salarial':
          await this.gerarRelatorioSalarial(doc, funcionarios);
          break;
        case 'referencias':
          await this.gerarRelatorioReferencias(doc, funcionarios);
          break;
        case 'localidade':
          await this.gerarRelatorioLocalidade(doc, funcionarios);
          break;
        case 'geral':
          await this.gerarRelatorioGeral(doc, funcionarios);
          break;
        default:
          throw new Error(`Tipo de relatório inválido: ${tipoRelatorio}`);
      }

      this.adicionarRodape(doc);

      return streamOutput ? doc : this.finalizeDocument(doc);

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      this.applyStyle(doc, this.styles.error)
        .text(`Erro ao gerar relatório: ${error.message}`, { align: 'center' });
      
      if (!streamOutput) {
        return this.finalizeDocument(doc);
      }
      return doc;
    }
  }

  finalizeDocument(doc) {
    return new Promise((resolve) => {
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.end();
    });
  }

  obterTituloRelatorio(tipo) {
    const titulos = {
      salarial: 'RELATÓRIO SALARIAL DA PREFEITURA',
      referencias: 'RELATÓRIO DE INDICAÇÕES DA PREFEITURA',
      localidade: 'RELATÓRIO DE LOCALIZAÇÃO DE SERVIDORES',
      geral: 'RELATÓRIO GERAL DE FUNCIONÁRIOS DA PREFEITURA'
    };
    return titulos[tipo] || titulos.geral;
  }

  async gerarRelatorioGeral(doc, funcionarios) {
    this.applyStyle(doc, this.styles.subheader)
      .text('LISTAGEM DE FUNCIONÁRIOS')
      .moveDown(0.5);

    const itemsPerPage = 8;
    let currentPage = 0;
    let remainingSpace = doc.page.height - doc.y - 100;

    for (let i = 0; i < funcionarios.length; i++) {
      const func = funcionarios[i];
      const itemHeight = 80; 

      if (remainingSpace < itemHeight) {
        doc.addPage();
        currentPage++;
        remainingSpace = doc.page.height - 100;
      }

      this.applyStyle(doc, this.styles.highlight)
        .text(`${i + 1}. ${func.nome}`);
      
      this.applyStyle(doc, this.styles.body)
        .text(`   Secretaria: ${func.secretaria || 'Não informada'}`, { indent: 20 })
        .text(`   Função: ${func.funcao || 'Não informada'}`, { indent: 20 })
        .text(`   Natureza: ${func.natureza || 'Não informada'}`, { indent: 20 })
        .text(`   Salário Bruto: ${this.formatarReais(func.salarioBruto)}`, { indent: 20 })
        .moveDown(0.5);

      remainingSpace -= itemHeight;
    }

    if (doc.y > doc.page.height - 150) {
      doc.addPage();
    } else {
      doc.moveDown(2);
    }

    this.gerarEstatisticasBasicas(doc, funcionarios);
  }

  gerarEstatisticasBasicas(doc, funcionarios) {
    this.applyStyle(doc, this.styles.subheader)
      .text('ESTATÍSTICAS BÁSICAS')
      .moveDown(0.5);

    const totalSalarios = funcionarios.reduce((sum, f) => sum + (f.salarioBruto || 0), 0);
    const mediaSalarial = totalSalarios / funcionarios.length;

    this.applyStyle(doc, this.styles.body)
      .text(`Total de funcionários: ${funcionarios.length}`)
      .text(`Total gasto com salários: ${this.formatarReais(totalSalarios)}`)
      .text(`Média salarial: ${this.formatarReais(mediaSalarial)}`)
      .moveDown(1);
  }

  async gerarRelatorioSalarial(doc, funcionarios) {
    const porNatureza = this.agruparPorCampo(funcionarios, 'natureza');
    const porSecretaria = this.agruparPorCampo(funcionarios, 'secretaria');

    const totalSalarios = funcionarios.reduce((sum, f) => sum + f.salarioBruto, 0);
    const mediaGeral = totalSalarios / funcionarios.length;

    this.applyStyle(doc, this.styles.subheader)
      .text('RESUMO GERAL')
      .moveDown(0.5);

    this.applyStyle(doc, this.styles.body)
      .text(`Total de funcionários: ${funcionarios.length}`)
      .text(`Gasto total com salários: ${this.formatarReais(totalSalarios)}`)
      .text(`Média salarial geral: ${this.formatarReais(mediaGeral)}`)
      .moveDown(1);

    this.applyStyle(doc, this.styles.subheader)
      .text('DISTRIBUIÇÃO POR NATUREZA DO CARGO')
      .moveDown(0.5);

    porNatureza.forEach(item => {
      const media = item.totalSalario / item.count;
      this.applyStyle(doc, this.styles.body)
        .text(`${item._id || 'Não informado'}:`)
        .text(`   Quantidade: ${item.count}`, { indent: 20 })
        .text(`   Total salarial: ${this.formatarReais(item.totalSalario)}`, { indent: 20 })
        .text(`   Média salarial: ${this.formatarReais(media)}`, { indent: 20 })
        .moveDown(0.5);
    });

    doc.addPage();
    this.applyStyle(doc, this.styles.subheader)
      .text('DISTRIBUIÇÃO POR SECRETARIA')
      .moveDown(0.5);

    porSecretaria.forEach(item => {
      const media = item.totalSalario / item.count;
      this.applyStyle(doc, this.styles.body)
        .text(`${item._id || 'Não informado'}:`)
        .text(`   Quantidade: ${item.count}`, { indent: 20 })
        .text(`   Total salarial: ${this.formatarReais(item.totalSalario)}`, { indent: 20 })
        .text(`   Média salarial: ${this.formatarReais(media)}`, { indent: 20 })
        .moveDown(0.5);
    });
  }

  async gerarRelatorioReferencias(doc, funcionarios) {
    const porReferencia = this.agruparPorCampo(funcionarios, 'referencia');

    this.applyStyle(doc, this.styles.subheader)
      .text('RESUMO DE INDICAÇÕES')
      .moveDown(0.5);

    this.applyStyle(doc, this.styles.body)
      .text(`Total de funcionários: ${funcionarios.length}`)
      .text(`Total de referências identificadas: ${porReferencia.length}`)
      .moveDown(1);

    this.applyStyle(doc, this.styles.subheader)
      .text('DETALHAMENTO POR REFERÊNCIA')
      .moveDown(0.5);

    porReferencia.sort((a, b) => b.count - a.count);

    porReferencia.forEach(item => {
      const percentual = ((item.count / funcionarios.length) * 100).toFixed(2);
      this.applyStyle(doc, this.styles.body)
        .text(`Referência: ${item._id || 'Não informado'}`)
        .text(`   Quantidade de indicações: ${item.count} (${percentual}%)`, { indent: 20 })
        .text(`   Média salarial: ${this.formatarReais(item.totalSalario / item.count)}`, { indent: 20 })
        .moveDown(0.5);
    });
  }

  async gerarRelatorioLocalidade(doc, funcionarios) {
    const porBairro = this.agruparPorCampo(funcionarios, 'bairro', 'cidade');
    const porCidade = this.agruparPorCampo(funcionarios, 'cidade');

    this.applyStyle(doc, this.styles.subheader)
      .text('DISTRIBUIÇÃO POR CIDADE')
      .moveDown(0.5);

    porCidade.forEach(item => {
      const percentual = ((item.count / funcionarios.length) * 100).toFixed(2);
      this.applyStyle(doc, this.styles.body)
        .text(`${item._id || 'Não informado'}: ${item.count} servidores (${percentual}%)`)
        .moveDown(0.5);
    });

    doc.addPage();
    this.applyStyle(doc, this.styles.subheader)
      .text('DETALHAMENTO POR BAIRRO')
      .moveDown(0.5);

    porBairro.forEach(item => {
      const percentual = ((item.count / funcionarios.length) * 100).toFixed(2);
      this.applyStyle(doc, this.styles.body)
        .text(`${item._id || 'Não informado'}: ${item.count} servidores (${percentual}%)`)
        .text(`   Cidade: ${item.cidade || 'Não informada'}`, { indent: 20 })
        .moveDown(0.5);
    });
  }

  agruparPorCampo(funcionarios, campo, campoAdicional = null) {
    const agrupado = {};

    funcionarios.forEach(func => {
      const valorCampo = func[campo] || 'Não informado';
      const valorAdicional = campoAdicional ? func[campoAdicional] || 'Não informado' : null;

      const chave = campoAdicional ? `${valorCampo}||${valorAdicional}` : valorCampo;

      if (!agrupado[chave]) {
        agrupado[chave] = {
          _id: valorCampo,
          count: 0,
          totalSalario: 0,
        };

        if (campoAdicional) {
          agrupado[chave][campoAdicional] = valorAdicional;
        }
      }

      agrupado[chave].count++;
      agrupado[chave].totalSalario += func.salarioBruto || 0;
    });

    return Object.values(agrupado);
  }

  async configurarCabecalho(doc, titulo) {
    const logoPath = path.join(__dirname, '../../images/link65.png');

    try {
      doc.image(logoPath, 50, 30, { width: 80 });
    } catch (e) {
      console.warn('Logo não encontrado, gerando relatório sem imagem');
    }

    this.applyStyle(doc, this.styles.header)
      .text('PREFEITURA MUNICIPAL', 150, 35)
      .fontSize(14)
      .text('SECRETARIA DE ADMINISTRAÇÃO', 150, 55)
      .fontSize(12)
      .text('Sistema de Gestão de Pessoal', 150, 75)
      .moveDown(2);

    this.applyStyle(doc, this.styles.title)
      .text(titulo, { align: 'center' })
      .moveDown(1);

    const now = new Date();
    this.applyStyle(doc, this.styles.footer)
      .text(`Emitido em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`, { align: 'right' })
      .moveDown(1);
  }

  adicionarRodape(doc) {
    const pages = doc.bufferedPageRange();

    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      if (doc.page.content && doc.page.content.length > 0) {
        this.applyStyle(doc, this.styles.footer)
          .text(`Página ${i + 1} de ${pages.count}`, 50, doc.page.height - 50, { align: 'center', width: 500 })
          .text('Prefeitura Municipal - Secretaria de Administração', 50, doc.page.height - 30, { align: 'center', width: 500 });
      }
    }

    doc.flushPages();
  }
}

module.exports = new RelatorioService();