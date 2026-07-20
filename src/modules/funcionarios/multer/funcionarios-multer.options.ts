import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/**
 * Ported from legacy/config/multerConfig.js — in-memory upload, 10MB limit.
 * Used with `FileFieldsInterceptor([{ name: 'foto' }, { name: 'arquivo' }])`.
 */
export const funcionariosMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
};

export const FUNCIONARIOS_UPLOAD_FIELDS = [
  { name: 'foto', maxCount: 1 },
  { name: 'arquivo', maxCount: 1 },
];
