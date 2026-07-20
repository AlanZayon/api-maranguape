import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class DeleteUsersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds!: string[];
}

export class UpdateLotacaoDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  usuariosIds!: string[];

  @IsOptional()
  @IsString()
  setorId?: string;

  @IsOptional()
  @IsString()
  coordenadoriaId?: string;

  @IsOptional()
  @IsString()
  lotacaoId?: string;
}

export class UpdateObservacoesDto {
  @IsOptional()
  observacoes?: unknown[];
}

export class ExportCsvDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];
}

export class BuscarIdsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  natureza?: string;

  @IsOptional()
  @IsString()
  secretaria?: string;

  @IsOptional()
  @IsString()
  funcao?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  /** Setor ids (canonical name); accepts legacy `setorIds` too. */
  @IsOptional()
  @IsArray()
  ids?: string[];

  @IsOptional()
  @IsArray()
  setorIds?: string[];

  @IsOptional()
  @IsString()
  subtreeRoot?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max?: number;
}

export class BuscarPorDivisoesDto {
  @IsOptional()
  ids?: string[] | string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  natureza?: string;

  @IsOptional()
  @IsString()
  secretaria?: string;

  @IsOptional()
  @IsString()
  funcao?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  referencia?: string;
}
