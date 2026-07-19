const mongoose = require('mongoose');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');

const db = dbFuncionarios();

const brandingSchema = new mongoose.Schema(
  {
    logoUrl: { type: String, default: null },
    faviconUrl: { type: String, default: null },
    displayName: { type: String, default: null },
    primaryColor: { type: String, default: '#1a5f2a' },
    secondaryColor: { type: String, default: null },
    primaryContrast: { type: String, default: '#ffffff' },
    headerBg: { type: String, default: '#1b1f24' },
    headerText: { type: String, default: '#f8f9fa' },
    sidebarBg: { type: String, default: '#ffffff' },
    sidebarText: { type: String, default: '#343a40' },
    surfaceBg: { type: String, default: '#ffffff' },
    pageBg: { type: String, default: '#f3f4f6' },
    textColor: { type: String, default: '#212529' },
    mutedColor: { type: String, default: '#6c757d' },
    borderColor: { type: String, default: '#dee2e6' },
    fontFamily: { type: String, default: null },
    fontUrl: { type: String, default: null },
    themeMode: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light',
    },
    customCss: { type: String, default: null },
  },
  { _id: false }
);

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
      type: brandingSchema,
      default: () => ({}),
    },
    settings: {
      vocabulary: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      seedOnCreate: {
        type: Boolean,
        default: true,
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
