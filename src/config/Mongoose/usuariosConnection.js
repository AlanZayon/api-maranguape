const mongoose = require('mongoose');

const connectUserDB = async (uri) => {
  await mongoose.createConnection(uri);
};

const disconnectUserDB = async () => {
  await mongoose.connections[0].close();
};

module.exports = {
  connectUserDB,
  disconnectUserDB,
};
