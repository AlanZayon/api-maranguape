import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateSetorDto {
  @IsString()
  nome!: string;

  @IsIn(['Setor', 'Subsetor'])
  tipo!: 'Setor' | 'Subsetor';

  @ValidateIf((dto: CreateSetorDto) => dto.tipo === 'Subsetor')
  @IsString({ message: 'parent precisa ter um setor pai.' })
  @IsOptional()
  parent?: string | null;
}
