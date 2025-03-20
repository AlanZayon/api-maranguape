const validate = (schema) => (req, res, next) => {
  if (
    req.body &&
    req.body.redesSociais &&
    typeof req.body.redesSociais === 'string'
  ) {
    req.body.redesSociais = JSON.parse(req.body.redesSociais);
  }

  if (
    req.body &&
    req.body.observacoes &&
    typeof req.body.observacoes === 'string'
  ) {
    req.body.observacoes = JSON.parse(req.body.observacoes || '[]');
  }

  const { error } = schema.validate(req.body);

  if (error) {
    console.error('Erro de validação:', error);
    return res.status(400).json({
      message: error.details.map((err) => err.message).join(', '),
    });
  }
  next();
};

module.exports = { validate };
