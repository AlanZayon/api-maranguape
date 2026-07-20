import { IsOptional, IsString } from 'class-validator';

export class RegisterReferenceDto {
  @IsOptional()
  @IsString()
  funcionarioId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsString()
  telefone?: string;
}
