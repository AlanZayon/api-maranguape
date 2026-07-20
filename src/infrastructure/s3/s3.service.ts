import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      region: this.config.get('AWS_REGION') || 'us-east-2',
      credentials: {
        accessKeyId: this.config.get('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
    this.bucket =
      this.config.get('S3_BUCKET_NAME') || 'system-maranguape';
  }

  async gerarUrlPreAssinada(key: string): Promise<string | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      return await getSignedUrl(this.client, command, { expiresIn: 3600 });
    } catch (error) {
      console.error('Erro ao gerar URL pré-assinada:', error);
      return null;
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    tenantId: string | null = null,
  ): Promise<string> {
    const fileName = `${Date.now()}.${file.mimetype.split('/')[1]}`;
    const tenantPrefix = tenantId ? `${tenantId}/` : '';
    const key = `uploads/${tenantPrefix}${folder}/${fileName}`;

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: file.mimetype,
        ACL: 'private',
      }),
      { expiresIn: 60 },
    );

    await axios.put(uploadUrl, file.buffer, {
      headers: { 'Content-Type': file.mimetype },
    });

    return key;
  }
}
