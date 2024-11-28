// config/s3Client.js
const { S3Client } = require('@aws-sdk/client-s3');

// Configura o cliente com a região e outras opções, se necessário
const s3Client = new S3Client({
  region: 'us-east-2', // substitua pela sua região
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

module.exports = s3Client;
