import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateReferenceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  /** `null` desvincula a referência, tornando-a raiz da hierarquia. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  parentId?: string | null;
}
