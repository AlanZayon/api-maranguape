/**
 * Central route registration — single place to mount domain modules.
 * Keeps app.js thin and makes new domains easy to plug in.
 */
const authRoutes = require('../routes/authRoutes');
const setoresRoutes = require('../routes/setoresRoutes');
const funcionariosRoutes = require('../routes/funcionariosRoutes');
const referenciasRoutes = require('../routes/referencesRoutes');
const searchRoutes = require('../routes/searchRoutes');
const tenantRoutes = require('../routes/tenantRoutes');
const dashboardRoutes = require('../routes/dashboardRoutes');
const auditRoutes = require('../routes/auditRoutes');

function registerRoutes(app) {
  app.use('/api/usuarios', authRoutes);
  app.use('/api/setores', setoresRoutes);
  app.use('/api/funcionarios', funcionariosRoutes);
  app.use('/api/referencias', referenciasRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/tenants', tenantRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/audit', auditRoutes);
}

module.exports = { registerRoutes };
