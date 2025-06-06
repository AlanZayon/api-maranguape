const mongoose = require('mongoose');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');

const db = dbFuncionarios();

const CargoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    required: true,
    trim: true,
  },
  cargo: {
    type: String,
    required: true,
    trim: true,
  },
  simbologia: {
    type: String,
    required: true,
    trim: true,
  },
  aDefinir: {
    type: Number,
    required: true,
  },
});

const CargoComissionado = db.model('Cargocomissionado', CargoSchema);

module.exports = CargoComissionado;
