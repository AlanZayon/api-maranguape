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
});

module.exports = db.model('Simbologia', limitesSimbologiaSchema);
