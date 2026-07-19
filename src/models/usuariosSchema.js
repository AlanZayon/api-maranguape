const mongoose = require('mongoose');
const connectToUsuariosDB = require('../config/Mongoose/usuariosConnection');
const bcrypt = require('bcryptjs');

const db = connectToUsuariosDB();

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ['owner', 'admin', 'user', 'readonly', 'superadmin'],
    default: 'user',
  },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
  lastValidToken: { type: String, default: null },
  tokenExpiresAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Compound unique: same username allowed across tenants; superadmins use tenantId null
userSchema.index(
  { tenantId: 1, username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } }
);

// Método para comparar senhas
userSchema.methods.comparePassword = async function (inputPassword) {
  return await bcrypt.compare(inputPassword, this.passwordHash);
};

const User = db.model('User', userSchema);

module.exports = User;
