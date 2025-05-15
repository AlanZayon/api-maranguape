const mongoose = require('mongoose');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');

const db = dbFuncionarios();

const referenceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  cargo: {
    type: String,
    trim: true,
  },
  telefone: {
    type: String,
    trim: true,
  },
});

const Referencia = db.model('Reference', referenceSchema);

module.exports = Referencia;
