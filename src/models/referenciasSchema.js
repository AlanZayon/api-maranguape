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
  /** Origem: funcionário da base ou pessoa externa. */
  origem: {
    type: String,
    enum: ['funcionario', 'externa'],
    default: 'externa',
    index: true,
  },
  /** Preenchido quando a referência é um funcionário já cadastrado. */
  funcionarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Funcionario',
    sparse: true,
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

referenceSchema.index({ tenantId: 1, name: 1 }, { unique: true });
referenceSchema.index(
  { tenantId: 1, funcionarioId: 1 },
  { unique: true, sparse: true }
);

const Referencia = db.model('Reference', referenceSchema);

module.exports = Referencia;
