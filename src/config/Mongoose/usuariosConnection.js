const connectToFuncionariosDB = require('./funcionariosConnection');

/**
 * Users share the same Mongo connection as funcionarios in single-tenant /
 * shared-DB mode. Uses USUARIOS URI only when it differs and is explicitly set
 * to a different database — otherwise reuse the funcionarios singleton.
 */
function connectToUsuariosDB(mongoUri) {
  const usuariosUri =
    mongoUri ||
    process.env.MONGO_CONNECTING_USUARIOS ||
    process.env.MONGO_CONNECTING_FUNCIONARIOS;
  const funcionariosUri = process.env.MONGO_CONNECTING_FUNCIONARIOS;

  // Same URI → reuse singleton (avoids connection pool exhaustion)
  if (!mongoUri && usuariosUri === funcionariosUri) {
    return connectToFuncionariosDB();
  }

  return connectToFuncionariosDB(usuariosUri);
}

module.exports = connectToUsuariosDB;
