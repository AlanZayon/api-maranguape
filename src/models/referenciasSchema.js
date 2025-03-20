const mongoose = require('mongoose');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');

const referenceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
});
const Referencia = dbFuncionarios.model('Reference', referenceSchema);

module.exports = Referencia;
