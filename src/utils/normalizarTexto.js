function normalizarTexto(valor) {
  if (typeof valor !== 'string' || !valor.trim()) return valor;
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .toUpperCase();
}

module.exports = normalizarTexto;
