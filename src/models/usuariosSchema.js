const mongoose = require('mongoose');
const dbUsuarios = require('../config/Mongoose/funcionariosConnection');
const bcrypt = require('bcryptjs');

const db = dbUsuarios();

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
});

// Método para comparar senhas
userSchema.methods.comparePassword = async function (inputPassword) {
  console.log('input', inputPassword);
  return await bcrypt.compare(inputPassword, this.passwordHash);
};

const User = db.model('User', userSchema);

module.exports = User;
