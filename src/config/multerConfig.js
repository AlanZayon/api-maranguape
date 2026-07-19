// config/multerConfig.js
const multer = require('multer');

const storage = multer.memoryStorage();

const limits = {
  fileSize: 10 * 1024 * 1024,
};

const upload = multer({
  storage,
  limits,
}).fields([
  { name: 'foto', maxCount: 1 },
  { name: 'arquivo', maxCount: 1 },
]);

const uploadSingle = multer({
  storage,
  limits,
}).single('file');

module.exports = upload;
module.exports.uploadSingle = uploadSingle;
module.exports.multerInstance = multer({ storage, limits });
