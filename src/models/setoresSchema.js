const mongoose = require('mongoose');
const dbFuncionarios = require("../config/Mongoose/funcionariosConnection")
// Esquema de coordenadoria
const setorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  tipo: { 
    type: String, 
    enum: ['Setor', 'Subsetor', 'Coordenadoria'], 
    required: true 
  },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', default: null }, // Referência ao setor pai
  funcionarios: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Funcionario' }], // Array de referências aos funcionários
  createdAt: { type: Date, default: Date.now }
});

const Setor = dbFuncionarios.model('Setor', setorSchema);

module.exports = Setor;
