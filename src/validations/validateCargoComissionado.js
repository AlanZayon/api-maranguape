const Joi = require('joi');

const normalizarTexto = (valor) => {
  if (typeof valor !== 'string' || !valor.trim()) return valor;
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .toUpperCase()
    .trim();
};

const normalizar = () => Joi.string().custom((value) => normalizarTexto(value));

const cargoComissionadoJoiSchema = Joi.object({
  tipo: normalizar().required(),
  cargo: normalizar().required(),
  simbologia: normalizar().required(),
  aDefinir: Joi.number().required(),
  limite: Joi.number().integer().min(0).optional().allow(null),
});

module.exports = { cargoComissionadoJoiSchema, normalizarTexto };
