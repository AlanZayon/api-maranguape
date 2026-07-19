const FuncionarioRepository = require('../repositories/FuncionariosRepository');
const TenantService = require('./tenantService');

const TIPOS_VALIDOS = ['geral', 'salarial', 'referencias', 'localidade'];

class RelatorioService {
  obterTituloRelatorio(tipo, displayName = null) {
    const titulos = {
      salarial: 'Relatório Salarial',
      referencias: 'Relatório de Indicações',
      localidade: 'Relatório de Localização de Servidores',
      geral: 'Relatório Geral de Funcionários',
    };
    const base = titulos[tipo] || titulos.geral;
    const orgao = typeof displayName === 'string' ? displayName.trim() : '';
    return orgao ? `${base} — ${orgao}` : base;
  }

  async carregarBrandingTenant(tenantId) {
    if (!tenantId) return null;
    try {
      const payload = await TenantService.getById(tenantId);
      return {
        ...(payload.branding || {}),
        displayName:
          payload.branding?.displayName || payload.name || null,
      };
    } catch {
      return null;
    }
  }

  validateFuncionarioData(funcionario) {
    const requiredFields = ['nome', 'secretaria', 'funcao', 'natureza', 'salarioBruto'];
    const missingFields = requiredFields.filter(
      (field) => !funcionario[field] && funcionario[field] !== 0
    );
    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }

  mapFuncionario(f) {
    return {
      id: f._id?.toString?.() || f._id,
      nome: f.nome || '',
      secretaria: f.secretaria || null,
      funcao: f.funcao || null,
      natureza: f.natureza || null,
      salarioBruto: typeof f.salarioBruto === 'number' ? f.salarioBruto : 0,
      referencia: f.referencia || null,
      bairro: f.bairro || null,
      cidade: f.cidade || null,
    };
  }

  calcularResumo(funcionarios) {
    const totalFuncionarios = funcionarios.length;
    const totalSalarios = funcionarios.reduce((sum, f) => sum + (f.salarioBruto || 0), 0);
    const mediaSalarial = totalFuncionarios > 0 ? totalSalarios / totalFuncionarios : 0;
    return { totalFuncionarios, totalSalarios, mediaSalarial };
  }

  enriquecerAgrupamento(items, totalFuncionarios) {
    return items
      .map((item) => ({
        chave: item._id || 'Não informado',
        count: item.count,
        totalSalario: item.totalSalario,
        mediaSalarial: item.count > 0 ? item.totalSalario / item.count : 0,
        percentual:
          totalFuncionarios > 0
            ? Number(((item.count / totalFuncionarios) * 100).toFixed(2))
            : 0,
        ...(item.cidade !== undefined ? { cidade: item.cidade } : {}),
      }))
      .sort((a, b) => b.count - a.count);
  }

  agruparPorCampo(funcionarios, campo, campoAdicional = null) {
    const agrupado = {};

    funcionarios.forEach((func) => {
      const valorCampo = func[campo] || 'Não informado';
      const valorAdicional = campoAdicional
        ? func[campoAdicional] || 'Não informado'
        : null;
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

  buildAgrupamentos(tipo, funcionarios) {
    const total = funcionarios.length;

    switch (tipo) {
      case 'salarial':
        return {
          porNatureza: this.enriquecerAgrupamento(
            this.agruparPorCampo(funcionarios, 'natureza'),
            total
          ),
          porSecretaria: this.enriquecerAgrupamento(
            this.agruparPorCampo(funcionarios, 'secretaria'),
            total
          ),
        };
      case 'referencias':
        return {
          porReferencia: this.enriquecerAgrupamento(
            this.agruparPorCampo(funcionarios, 'referencia'),
            total
          ),
        };
      case 'localidade':
        return {
          porCidade: this.enriquecerAgrupamento(
            this.agruparPorCampo(funcionarios, 'cidade'),
            total
          ),
          porBairro: this.enriquecerAgrupamento(
            this.agruparPorCampo(funcionarios, 'bairro', 'cidade'),
            total
          ),
        };
      case 'geral':
      default:
        return null;
    }
  }

  /**
   * Monta o payload JSON do relatório (fonte da verdade para a página de preview).
   * Exige `ids` não vazio para evitar varrer a base inteira sem escopo.
   */
  async obterDadosRelatorio(ids, tipoRelatorio, tenantId = null) {
    if (!TIPOS_VALIDOS.includes(tipoRelatorio)) {
      const err = new Error(
        `Tipo de relatório inválido. Opções: ${TIPOS_VALIDOS.join(', ')}`
      );
      err.status = 400;
      throw err;
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      const err = new Error(
        'Selecione pelo menos um funcionário para gerar o relatório.'
      );
      err.status = 400;
      throw err;
    }

    const raw = await FuncionarioRepository.findByIds(ids, tenantId);
    const funcionarios = raw
      .map((f) => this.mapFuncionario(f))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

    const avisos = [];
    const incompletos = raw.filter((f) => !this.validateFuncionarioData(f).isValid);
    if (incompletos.length > 0) {
      avisos.push(
        `${incompletos.length} funcionário(s) com dados incompletos. O relatório pode estar parcial.`
      );
    }

    if (funcionarios.length === 0) {
      avisos.push('Nenhum funcionário encontrado para os critérios selecionados.');
    }

    const resumo = this.calcularResumo(funcionarios);
    const agrupamentos = this.buildAgrupamentos(tipoRelatorio, funcionarios);
    const branding = await this.carregarBrandingTenant(tenantId);

    return {
      tipo: tipoRelatorio,
      titulo: this.obterTituloRelatorio(
        tipoRelatorio,
        branding?.displayName || null
      ),
      geradoEm: new Date().toISOString(),
      funcionarios,
      resumo,
      agrupamentos,
      avisos,
      branding,
    };
  }
}

module.exports = new RelatorioService();
module.exports.TIPOS_VALIDOS = TIPOS_VALIDOS;
