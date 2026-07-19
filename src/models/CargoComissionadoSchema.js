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
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    default: null,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
});

CargoSchema.index({ tenantId: 1, cargo: 1 }, { unique: true });

const CargoComissionado = db.model('Cargocomissionado', CargoSchema);

module.exports = CargoComissionado;
