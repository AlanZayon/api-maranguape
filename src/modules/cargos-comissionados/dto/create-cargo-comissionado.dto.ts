import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCargoComissionadoDto {
  @IsString()
  @IsNotEmpty()
  tipo!: string;

  @IsString()
  @IsNotEmpty()
  cargo!: string;

  @IsString()
  @IsNotEmpty()
  simbologia!: string;

  @Type(() => Number)
  @IsNumber()
  aDefinir!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limite?: number | null;
}
