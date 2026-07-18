/**
 * Normaliza observações legadas (string) e objetos para o formato
 * { texto, createdAt }.
 * Strings antigas ficam com createdAt null (data desconhecida).
 * Novos objetos sem data recebem Date.now quando assignMissingDate=true.
 */
function normalizeObservacoes(observacoes = [], { assignMissingDate = true } = {}) {
  if (!Array.isArray(observacoes)) return [];

  return observacoes
    .map((obs) => {
      if (obs == null) return null;

      if (typeof obs === 'string') {
        const texto = obs.trim();
        if (!texto) return null;
        return { texto, createdAt: null };
      }

      const texto = String(obs.texto ?? obs.text ?? '').trim();
      if (!texto) return null;

      const rawDate = obs.createdAt ?? obs.data ?? null;
      let createdAt = null;
      if (rawDate) {
        const parsed = new Date(rawDate);
        createdAt = Number.isNaN(parsed.getTime()) ? null : parsed;
      } else if (assignMissingDate) {
        createdAt = new Date();
      }

      const normalized = { texto, createdAt };
      if (obs._id) normalized._id = obs._id;
      return normalized;
    })
    .filter(Boolean);
}

module.exports = normalizeObservacoes;
