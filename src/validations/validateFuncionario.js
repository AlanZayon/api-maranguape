const Joi = require('joi');

// Função para normalizar texto: remove acentos, troca ç por c e converte para maiúsculas
const normalizarTexto = (valor) => {
  if (typeof valor !== 'string' || !valor.trim()) return valor;
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .toUpperCase();
};

const normalizar = () => Joi.string().custom((value) => normalizarTexto(value));

// Esquema Joi atualizado
const funcionarioJoiSchema = Joi.object({
  nome: normalizar().required(),
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
  secretaria: normalizar().required(),
  funcao: normalizar().required(),
  tipo: normalizar().required(),
  natureza: normalizar().required(),
  referencia: normalizar().required(),
  redesSociais: Joi.array()
    .items(
      Joi.object({
        link: Joi.string().uri().required(),
        nome: normalizar().required(),
      })
    )
    .optional(),
  salarioBruto: Joi.number().required(),
  cidade: normalizar().allow(''),
  endereco: normalizar().allow(''),
  bairro: normalizar().allow(''),
  telefone: Joi.string().allow(''),
  observacoes: Joi.array().items(Joi.string()).optional(),
  arquivo: Joi.object({
    buffer: Joi.binary().required(),
    mimetype: Joi.string().valid('application/pdf').required(),
  })
    .optional()
    .allow(null),
  coordenadoria: normalizar().required(),
  createdAt: Joi.date().default(() => new Date()),
});

module.exports = { funcionarioJoiSchema };
