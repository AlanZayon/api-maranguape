const mongoose = require('mongoose');
const dbFuncionarios = require("../config/Mongoose/funcionariosConnection")

// Esquema de funcionário
const funcionarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  foto: { type: String, default: null }, // URL ou caminho da foto
  secretaria: { type: String, required: true },
  funcao: { type: String, required: true },
  natureza: { type: String, required: true },
  referencia: { type: String, required: true },
  redesSociais: [{
    link: { type: String},
    nome: { type: String},
    _id: { type: mongoose.Schema.Types.ObjectId, auto: false } 
  }],
  salarioBruto: { type: Number, required: true },
  salarioLiquido: { type: Number, required: true },
  endereco: { type: String, required: true },
  bairro: { type: String, required: true },
  telefone: { type: String, required: true },
  observacoes: [{ type: String }],
  arquivo: { type: String, default: null  },
  coordenadoria: { type: mongoose.Schema.Types.ObjectId, ref: 'Coordenadoria', required: true }, // Referência à coordenadoria
  createdAt: { type: Date, default: Date.now }
});

const Funcionario = dbFuncionarios.model('Funcionario', funcionarioSchema);

module.exports = Funcionario;
