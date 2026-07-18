const mongoose = require('mongoose');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');
const db = dbFuncionarios();

const limitesSimbologiaSchema = new mongoose.Schema({
  simbologia: {
    type: String,
    required: true,
  },
  limite: {
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

module.exports = db.model('Simbologia', limitesSimbologiaSchema);
