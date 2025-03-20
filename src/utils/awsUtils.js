const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = require('../config/aws');
const axios = require('axios');

class awsUtils {
  static async gerarUrlPreAssinada(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME || 'system-maranguape',
        Key: key,
      });

      return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (error) {
      console.error('Erro ao gerar URL pré-assinada:', error);
      return null;
    }
  }

  static async uploadFile(file, folder) {
    const fileName = `${Date.now()}.${file.mimetype.split('/')[1]}`;
    const key = `uploads/${folder}/${fileName}`;

    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: 'system-maranguape',
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'private',
      }),
      { expiresIn: 60 }
    );

    await axios.put(uploadUrl, file.buffer, {
      headers: { 'Content-Type': file.mimetype },
    });

    return key;
  }
}

module.exports = awsUtils;
