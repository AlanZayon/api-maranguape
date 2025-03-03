const mongoose = require('mongoose');

const connectFuncDB = async (uri) => {
  await mongoose.createConnection(uri);
};

const disconnectFuncDB = async () => {
  await mongoose.connections[0].close();
};

module.exports = {
  connectFuncDB,
  disconnectFuncDB,
};
