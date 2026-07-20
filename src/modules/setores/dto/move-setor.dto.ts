import { IsOptional, IsString } from 'class-validator';

export class MoveSetorDto {
  @IsOptional()
  @IsString()
  parent?: string | null;
}
