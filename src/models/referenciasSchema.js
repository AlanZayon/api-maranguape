const mongoose = require('mongoose');

const referenceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
});

module.exports = mongoose.connections[0].model('Reference', referenceSchema);
