const mongoose = require('mongoose');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');

const db = dbFuncionarios();

// Esquema de funcionário
const funcionarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  foto: { type: String, default: null },
  secretaria: { type: String, required: true },
  funcao: { type: String, required: true },
  tipo: { type: String, required: true },
  natureza: { type: String, required: true },
  referencia: { type: String, required: true },
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
  observacoes: [{ type: String }],
  arquivo: { type: String, default: null },
  coordenadoria: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coordenadoria',
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

const Funcionario = db.model('Funcionario', funcionarioSchema);

module.exports = Funcionario;
