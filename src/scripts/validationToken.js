const cron = require('node-cron');
const User = require('../models/usuariosSchema');

async function checkExpiredTokens() {
 console.log(`[${new Date().toISOString()}] Verificando tokens expirados...`);

  const expirationDate = new Date();

  try {
    const result = await User.updateMany(
      {
        lastValidToken: { $ne: null },
        tokenExpiresAt: { $lte: expirationDate },
      },
      {
        $set: {
          lastValidToken: null,
          tokenExpiresAt: null,
        },
      }
    );

    console.log(`Tokens expirados limpos: ${result.modifiedCount}`);
  } catch (err) {
    console.error('Erro ao verificar tokens expirados:', err);
  }}
checkExpiredTokens();
cron.schedule('0 * * * *', checkExpiredTokens); // e a cada 1h
