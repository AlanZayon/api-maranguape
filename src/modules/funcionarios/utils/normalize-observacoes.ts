export type ObservacaoInput =
  | string
  | { texto?: string; text?: string; createdAt?: unknown; data?: unknown; _id?: unknown }
  | null
  | undefined;

export type NormalizedObservacao = {
  texto: string;
  createdAt: Date | null;
  _id?: unknown;
};

/**
 * Normalizes legacy observações (string) and objects into
 * `{ texto, createdAt }`. Ported from legacy/utils/normalizeObservacoes.js.
 *
 * Old strings keep `createdAt: null` (unknown date). New objects without a
 * date receive `new Date()` when `assignMissingDate` is true.
 */
export function normalizeObservacoes(
  observacoes: unknown[] = [],
  { assignMissingDate = true }: { assignMissingDate?: boolean } = {},
): NormalizedObservacao[] {
  if (!Array.isArray(observacoes)) return [];

  return observacoes
    .map((raw): NormalizedObservacao | null => {
      const obs = raw as ObservacaoInput;
      if (obs == null) return null;

      if (typeof obs === 'string') {
        const texto = obs.trim();
        if (!texto) return null;
        return { texto, createdAt: null };
      }

      const texto = String(obs.texto ?? obs.text ?? '').trim();
      if (!texto) return null;

      const rawDate = obs.createdAt ?? obs.data ?? null;
      let createdAt: Date | null = null;
      if (rawDate) {
        const parsed = new Date(rawDate as string | number | Date);
        createdAt = Number.isNaN(parsed.getTime()) ? null : parsed;
      } else if (assignMissingDate) {
        createdAt = new Date();
      }

      const normalized: NormalizedObservacao = { texto, createdAt };
      if (obs._id) normalized._id = obs._id;
      return normalized;
    })
    .filter((v): v is NormalizedObservacao => v !== null);
}
