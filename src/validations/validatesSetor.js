const Joi = require('joi');

// Função segura para normalizar texto
const normalizarTexto = (valor) => {
  if (typeof valor !== 'string' || !valor.trim()) return valor;
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .toUpperCase();
};

// Helper para aplicar a normalização
const normalizar = () => Joi.string().custom((value) => normalizarTexto(value));

const setorValidationSchema = Joi.object({
  nome: normalizar().required(),
  tipo: Joi.string().valid('Setor', 'Subsetor', 'Coordenadoria').required(),
  parent: Joi.when('tipo', {
    is: Joi.string().valid('Subsetor', 'Coordenadoria'),
    then: Joi.string().required().messages({
      'any.required': '{#label} precisa ter um setor pai.',
    }),
    otherwise: Joi.allow(null),
  }),
  funcionarios: Joi.array().items(Joi.string()),
  createdAt: Joi.date().default(() => new Date()),
});

module.exports = { setorValidationSchema };
