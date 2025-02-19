const mongoose = require('mongoose');
const dbFuncionarios = require("../config/Mongoose/funcionariosConnection");

// Esquema de coordenadoria
const setorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  tipo: { 
    type: String, 
    enum: ['Setor', 'Subsetor', 'Coordenadoria'], 
    required: true 
  },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', default: null }, // Referência ao setor pai
  funcionarios: [
    { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Funcionario',
      validate: {
        validator: function(value) {
          return this.tipo === 'Coordenadoria' || value.length === 0;
        },
        message: "O campo 'funcionarios' só pode ser preenchido se o tipo for 'Coordenadoria'."
      }
    }
  ], // Array de referências aos funcionários
  createdAt: { type: Date, default: Date.now }
});

// Middleware para ajustar o campo 'funcionarios'
setorSchema.pre('save', function(next) {
  if (this.tipo !== 'Coordenadoria') {
    this.funcionarios = []; // Limpa o campo 'funcionarios' se o tipo não for 'Coordenadoria'
  }
  next();
});

module.exports = dbFuncionarios.then(db => db.model('Setor', setorSchema));

