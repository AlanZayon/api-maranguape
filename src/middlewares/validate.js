const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details.map((err) => err.message).join(', '),
    });
  }
  next();
};

module.exports = { validate };
