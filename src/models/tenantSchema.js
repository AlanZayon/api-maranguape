const mongoose = require('mongoose');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');

const db = dbFuncionarios();

const tenantSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    branding: {
      logoUrl: { type: String, default: null },
      primaryColor: { type: String, default: '#1a5f2a' },
      displayName: { type: String, default: null },
    },
    settings: {
      vocabulary: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

const Tenant = db.model('Tenant', tenantSchema);

module.exports = Tenant;
