const mongoose = require('mongoose');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');

const db = dbFuncionarios();

const setorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  tipo: {
    type: String,
    enum: ['Setor', 'Subsetor'],
    required: true,
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Setor',
    default: null,
    index: true,
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
  createdAt: { type: Date, default: Date.now },
});

setorSchema.index({ tenantId: 1, parent: 1 });

const Setor = db.model('Setor', setorSchema);

module.exports = Setor;
