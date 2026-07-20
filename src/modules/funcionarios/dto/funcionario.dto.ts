import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { normalizarTexto } from '../../../common/utils/normalizar-texto';
import { parseMaybeJsonArray, parseRedesSociais } from './transforms';

const normalize = ({ value }: { value: unknown }) => normalizarTexto(value);

/**
 * Body validation for POST `/api/funcionarios` and PUT
 * `/api/funcionarios/edit-funcionario/:id`.
 * Approximates legacy/validations/validateFuncionario.js (funcionarioJoiSchema).
 * `setorId`/`coordenadoria` "at least one required" is enforced in the
 * service layer, matching the legacy create/update flow.
 */
export class FuncionarioDto {
  @IsString()
  @Transform(normalize)
  nome!: string;

  @IsString()
  @Transform(normalize)
  secretaria!: string;

  @IsString()
  @Transform(normalize)
  funcao!: string;

  @IsOptional()
  @IsString()
  @Transform(normalize)
  tipo?: string;

  @IsString()
  @Transform(normalize)
  natureza!: string;

  @IsOptional()
  @IsString()
  @Transform(normalize)
  referencia?: string;

  /** Parsed/sanitized in Transform — no nested ValidateNested (multipart safe). */
  @IsOptional()
  @Transform(({ value }) => parseRedesSociais(value))
  @IsArray()
  redesSociais?: Array<{ link: string; nome: string }>;

  @Type(() => Number)
  @IsNumber()
  salarioBruto!: number;

  @IsOptional()
  @IsString()
  @Transform(normalize)
  cidade?: string;

  @IsOptional()
  @IsString()
  @Transform(normalize)
  endereco?: string;

  @IsOptional()
  @IsString()
  @Transform(normalize)
  bairro?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @Transform(({ value }) => parseMaybeJsonArray(value))
  @IsArray()
  observacoes?: unknown[];

  /** Canonical lotação id. */
  @IsOptional()
  @IsString()
  setorId?: string;

  /** Compatibility alias for `setorId`. */
  @IsOptional()
  @IsString()
  coordenadoria?: string;

  @IsOptional()
  @IsString()
  inicioContrato?: string;

  @IsOptional()
  @IsString()
  fimContrato?: string;
}

export const TIPOS_RELATORIO = [
  'geral',
  'salarial',
  'referencias',
  'localidade',
] as const;

export class ObterDadosRelatorioDto {
  @IsOptional()
  @IsArray()
  ids?: string[];

  @IsOptional()
  @IsIn(TIPOS_RELATORIO)
  tipo?: (typeof TIPOS_RELATORIO)[number];
}
