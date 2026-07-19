const mongoose = require('mongoose');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');

const db = dbFuncionarios();

const funcionarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  foto: { type: String, default: null },
  secretaria: { type: String, required: true },
  funcao: { type: String, required: true },
  tipo: { type: String },
  natureza: { type: String, required: true },
  referencia: { type: String },
  redesSociais: [
    {
      link: { type: String },
      nome: { type: String },
      _id: { type: mongoose.Schema.Types.ObjectId, auto: false },
    },
  ],
  salarioBruto: { type: Number, required: true },
  endereco: { type: String },
  cidade: { type: String },
  bairro: { type: String },
  telefone: { type: String },
  // Mixed: aceita legado (string) e o formato atual { texto, createdAt }
  observacoes: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  arquivo: { type: String, default: null },
  /** Lotação: Setor ou Subsetor (mesmo collection Setor). */
  setorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Setor',
    required: true,
    index: true,
  },
  inicioContrato: { type: Date, default: null },
  fimContrato: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    set: function (value) {
      return value === '' ? null : value;
    },
    validate: {
      validator: function (value) {
        return (
          value === null ||
          value instanceof Date ||
          value === 'indeterminado'
        );
      },
      message: 'fimContrato deve ser uma data válida ou "indeterminado"',
    },
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

funcionarioSchema.index({ tenantId: 1, nome: 1 }, { unique: true });
funcionarioSchema.index({ tenantId: 1, setorId: 1 });
funcionarioSchema.index({ tenantId: 1, fimContrato: 1 });
funcionarioSchema.index({ tenantId: 1, natureza: 1 });

const Funcionario = db.model('Funcionario', funcionarioSchema);

module.exports = Funcionario;
