import { IsString } from 'class-validator';

export class RenameSetorDto {
  @IsString()
  nome!: string;
}
