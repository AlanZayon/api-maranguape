// config/multerConfig.js
const multer = require('multer');

// Configuração do Multer para armazenamento em memória
const storage = multer.memoryStorage();

// Configuração do Multer para aceitar múltiplos arquivos: foto e arquivo (PDF)
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // Limite de 10MB para os arquivos (pode ajustar conforme necessário)
  }
}).fields([
  { name: 'foto', maxCount: 1 },
  { name: 'arquivo', maxCount: 1 }
]);

module.exports = upload;
