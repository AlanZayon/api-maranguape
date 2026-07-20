import { Transform } from 'class-transformer';
import { IsString, IsUrl } from 'class-validator';
import { normalizarTexto } from '../../../common/utils/normalizar-texto';

function normalizeLink({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export class RedeSocialDto {
  @Transform(normalizeLink)
  @IsUrl(
    { require_protocol: true, require_tld: false },
    { message: 'redesSociais.link deve ser uma URL válida' },
  )
  link!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizarTexto(value) : value,
  )
  @IsString({ message: 'redesSociais.nome must be a string' })
  nome!: string;
}
