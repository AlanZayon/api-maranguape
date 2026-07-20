/**
 * Removes accents, converts ç/Ç to c/C, and upper-cases the value.
 * Ported from legacy/utils/normalizarTexto.js.
 */
export function normalizarTexto<T>(valor: T): T | string {
  if (typeof valor !== 'string' || !valor.trim()) return valor;
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .toUpperCase();
}
