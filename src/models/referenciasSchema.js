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

const Referencia = db.model('Reference', referenceSchema);

module.exports = Referencia;
