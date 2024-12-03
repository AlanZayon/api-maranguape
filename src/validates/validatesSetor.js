
const Joi = require('joi');

const setorValidationSchema = Joi.object({
  nome: Joi.string().required(),
  tipo: Joi.string().valid('Setor', 'Subsetor', 'Coordenadoria').required(),
  parent: Joi.when('tipo', {
    is: Joi.string().valid('Subsetor', 'Coordenadoria'),
    then: Joi.string().required().messages({
      'any.required': '{#label} precisa ter um setor pai.'
    }),
    otherwise: Joi.allow(null)
  }),
  funcionarios: Joi.array().items(Joi.string()),
  createdAt: Joi.date().default(() => new Date())
});

function validateSetor(data) {
  return setorValidationSchema.validate(data, { abortEarly: false });
}

module.exports = validateSetor;
