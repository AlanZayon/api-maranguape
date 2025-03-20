const mongoose = require('mongoose');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');

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
  limite: {
    type: Number,
    required: true,
  },
});

const CargoComissionado = dbFuncionarios.model(
  'Cargocomissionado',
  CargoSchema
);

module.exports = CargoComissionado;
