import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppError } from '../../../common/errors/app-error';
import { S3Service } from '../../../infrastructure/s3/s3.service';
import { FuncionariosRepository } from '../repositories/funcionarios.repository';
import { Tenant, TenantDocument } from '../../tenants/schemas/tenant.schema';

const TIPOS_VALIDOS = ['geral', 'salarial', 'referencias', 'localidade'] as const;
type TipoRelatorio = (typeof TIPOS_VALIDOS)[number];

type FuncionarioMapped = {
  id: unknown;
  nome: string;
  secretaria: string | null;
  funcao: string | null;
  natureza: string | null;
  salarioBruto: number;
  referencia: string | null;
  bairro: string | null;
  cidade: string | null;
};

type Agrupamento = {
  chave: unknown;
  count: number;
  totalSalario: number;
  mediaSalarial: number;
  percentual: number;
  cidade?: unknown;
};

/**
 * Ported from legacy/services/RelatorioService.js.
 */
@Injectable()
export class RelatorioService {
  static readonly TIPOS_VALIDOS = TIPOS_VALIDOS;

  constructor(
    private readonly funcionariosRepository: FuncionariosRepository,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    private readonly s3Service: S3Service,
  ) {}

  obterTituloRelatorio(tipo: TipoRelatorio, displayName: string | null = null) {
    const titulos: Record<TipoRelatorio, string> = {
      salarial: 'Relatório Salarial',
      referencias: 'Relatório de Indicações',
      localidade: 'Relatório de Localização de Servidores',
      geral: 'Relatório Geral de Funcionários',
    };
    const base = titulos[tipo] || titulos.geral;
    const orgao = typeof displayName === 'string' ? displayName.trim() : '';
    return orgao ? `${base} — ${orgao}` : base;
  }

  private async resolveMediaUrl(value: unknown): Promise<string | null> {
    if (!value) return null;
    const raw = String(value);
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
    try {
      return (await this.s3Service.gerarUrlPreAssinada(raw)) || raw;
    } catch {
      return raw;
    }
  }

  async carregarBrandingTenant(tenantId: string | null) {
    if (!tenantId) return null;
    try {
      const tenant = await this.tenantModel.findById(tenantId).lean();
      if (!tenant) return null;
      const branding = (tenant.branding || {}) as Record<string, unknown>;
      return {
        ...branding,
        displayName: branding.displayName || tenant.name || null,
        logoUrl: await this.resolveMediaUrl(branding.logoUrl),
        faviconUrl: await this.resolveMediaUrl(branding.faviconUrl),
      };
    } catch {
      return null;
    }
  }

  validateFuncionarioData(funcionario: Record<string, unknown>) {
    const requiredFields = ['nome', 'secretaria', 'funcao', 'natureza', 'salarioBruto'];
    const missingFields = requiredFields.filter(
      (field) => !funcionario[field] && funcionario[field] !== 0,
    );
    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }

  mapFuncionario(f: Record<string, unknown>): FuncionarioMapped {
    return {
      id: (f._id as { toString?: () => string })?.toString?.() ?? f._id,
      nome: (f.nome as string) || '',
      secretaria: (f.secretaria as string) || null,
      funcao: (f.funcao as string) || null,
      natureza: (f.natureza as string) || null,
      salarioBruto: typeof f.salarioBruto === 'number' ? f.salarioBruto : 0,
      referencia: (f.referencia as string) || null,
      bairro: (f.bairro as string) || null,
      cidade: (f.cidade as string) || null,
    };
  }

  calcularResumo(funcionarios: FuncionarioMapped[]) {
    const totalFuncionarios = funcionarios.length;
    const totalSalarios = funcionarios.reduce((sum, f) => sum + (f.salarioBruto || 0), 0);
    const mediaSalarial = totalFuncionarios > 0 ? totalSalarios / totalFuncionarios : 0;
    return { totalFuncionarios, totalSalarios, mediaSalarial };
  }

  enriquecerAgrupamento(
    items: { _id: unknown; count: number; totalSalario: number; [k: string]: unknown }[],
    totalFuncionarios: number,
  ): Agrupamento[] {
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

  agruparPorCampo(
    funcionarios: FuncionarioMapped[],
    campo: keyof FuncionarioMapped,
    campoAdicional: keyof FuncionarioMapped | null = null,
  ) {
    const agrupado: Record<
      string,
      { _id: unknown; count: number; totalSalario: number; [k: string]: unknown }
    > = {};

    funcionarios.forEach((func) => {
      const valorCampo = func[campo] || 'Não informado';
      const valorAdicional = campoAdicional ? func[campoAdicional] || 'Não informado' : null;
      const chave = campoAdicional
        ? `${String(valorCampo)}||${String(valorAdicional)}`
        : String(valorCampo);

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

      agrupado[chave].count += 1;
      agrupado[chave].totalSalario += func.salarioBruto || 0;
    });

    return Object.values(agrupado);
  }

  buildAgrupamentos(tipo: TipoRelatorio, funcionarios: FuncionarioMapped[]) {
    const total = funcionarios.length;

    switch (tipo) {
      case 'salarial':
        return {
          porNatureza: this.enriquecerAgrupamento(
            this.agruparPorCampo(funcionarios, 'natureza'),
            total,
          ),
          porSecretaria: this.enriquecerAgrupamento(
            this.agruparPorCampo(funcionarios, 'secretaria'),
            total,
          ),
        };
      case 'referencias':
        return {
          porReferencia: this.enriquecerAgrupamento(
            this.agruparPorCampo(funcionarios, 'referencia'),
            total,
          ),
        };
      case 'localidade':
        return {
          porCidade: this.enriquecerAgrupamento(
            this.agruparPorCampo(funcionarios, 'cidade'),
            total,
          ),
          porBairro: this.enriquecerAgrupamento(
            this.agruparPorCampo(funcionarios, 'bairro', 'cidade'),
            total,
          ),
        };
      case 'geral':
      default:
        return null;
    }
  }

  /**
   * Builds the report JSON payload (source of truth for the preview page).
   * Requires non-empty `ids` to avoid scanning the whole base without scope.
   */
  async obterDadosRelatorio(
    ids: string[],
    tipoRelatorio: string,
    tenantId: string | null = null,
  ) {
    if (!TIPOS_VALIDOS.includes(tipoRelatorio as TipoRelatorio)) {
      throw new AppError(
        `Tipo de relatório inválido. Opções: ${TIPOS_VALIDOS.join(', ')}`,
        400,
        'BAD_REQUEST',
      );
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError(
        'Selecione pelo menos um funcionário para gerar o relatório.',
        400,
        'BAD_REQUEST',
      );
    }

    const tipo = tipoRelatorio as TipoRelatorio;
    const raw = (await this.funcionariosRepository.findByIds(
      ids,
      tenantId,
    )) as Record<string, unknown>[];
    const funcionarios = raw
      .map((f) => this.mapFuncionario(f))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

    const avisos: string[] = [];
    const incompletos = raw.filter((f) => !this.validateFuncionarioData(f).isValid);
    if (incompletos.length > 0) {
      avisos.push(
        `${incompletos.length} funcionário(s) com dados incompletos. O relatório pode estar parcial.`,
      );
    }

    if (funcionarios.length === 0) {
      avisos.push('Nenhum funcionário encontrado para os critérios selecionados.');
    }

    const resumo = this.calcularResumo(funcionarios);
    const agrupamentos = this.buildAgrupamentos(tipo, funcionarios);
    const branding = await this.carregarBrandingTenant(tenantId);

    return {
      tipo,
      titulo: this.obterTituloRelatorio(
        tipo,
        (branding?.displayName as string) || null,
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
