const Joi = require('joi');

// Esquema Joi para validar os dados do funcionário
const funcionarioJoiSchema = Joi.object({
  nome: Joi.string().required(),
  foto: Joi.object({
    buffer: Joi.binary().required(),
    mimetype: Joi.string()
      .valid('image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp')
      .required(),
    size: Joi.number()
      .max(5 * 1024 * 1024)
      .required(),
  })
    .optional()
    .allow(null),
  secretaria: Joi.string().required(),
  funcao: Joi.string().required(),
  tipo: Joi.string().required(),
  natureza: Joi.string().required(),
  referencia: Joi.string().required(),
  redesSociais: Joi.array()
    .items(
      Joi.object({
        link: Joi.string().uri().required(),
        nome: Joi.string().required(),
      })
    )
    .optional(),
  salarioBruto: Joi.number().required(),
  salarioLiquido: Joi.number().required(),
  endereco: Joi.string().allow(''),
  bairro: Joi.string().allow(''),
  telefone: Joi.string().allow(''),
  observacoes: Joi.array().items(Joi.string()).optional(),
  arquivo: Joi.object({
    buffer: Joi.binary().required(),
    mimetype: Joi.string().valid('application/pdf').required(),
  })
    .optional()
    .allow(null),
  coordenadoria: Joi.string().required(),
  createdAt: Joi.date().default(() => new Date()),
});

module.exports = { funcionarioJoiSchema };
