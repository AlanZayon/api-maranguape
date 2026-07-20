import { BadRequestException } from '@nestjs/common';
import { normalizarTexto } from '../../../common/utils/normalizar-texto';

/**
 * Multipart form-data (multer) always sends non-file fields as strings, so
 * array/object fields such as `redesSociais` and `observacoes` arrive JSON
 * stringified. Ported from legacy/middlewares/validate.js.
 */
export function parseMaybeJsonArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : value;
    } catch {
      return value;
    }
  }
  return value ?? [];
}

function normalizeLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    // eslint-disable-next-line no-new
    new URL(withProtocol);
    return withProtocol;
  } catch {
    return null;
  }
}

/**
 * Parse + sanitize redesSociais from multipart JSON.
 * Avoids nested class-validator DTOs (whitelist strips plain nested props).
 */
export function parseRedesSociais(
  value: unknown,
): Array<{ link: string; nome: string }> {
  const parsed = parseMaybeJsonArray(value);
  if (!Array.isArray(parsed)) return [];

  const result: Array<{ link: string; nome: string }> = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const rawLink = typeof row.link === 'string' ? row.link : '';
    const rawNome = typeof row.nome === 'string' ? row.nome.trim() : '';
    if (!rawLink.trim() || !rawNome) continue;

    const link = normalizeLink(rawLink);
    if (!link) {
      throw new BadRequestException(
        'redesSociais.link deve ser uma URL válida',
      );
    }

    result.push({
      link,
      nome: String(normalizarTexto(rawNome)),
    });
  }
  return result;
}
