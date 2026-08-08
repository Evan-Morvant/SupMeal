import crypto from 'crypto';
import fs from 'fs';
import { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import { AppError } from '../common/app-error';
import { RECIPE_IMAGE_DIR } from '../common/uploads';
import { env } from '../config/env';

/** Types acceptés, avec l'extension que le serveur leur donnera. */
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, done) => {
    fs.mkdir(RECIPE_IMAGE_DIR, { recursive: true }, (err) => done(err, RECIPE_IMAGE_DIR));
  },
  // Le nom vient du serveur, jamais du client : un nom fourni pourrait porter
  // une traversée de chemin ou une double extension exécutable.
  filename: (_req, file, done) => {
    const extension = ALLOWED_IMAGE_TYPES[file.mimetype] ?? '';
    done(null, crypto.randomUUID() + extension);
  },
});

const uploadImage = multer({
  storage,
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, done) => {
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      done(new AppError(400, 'UNSUPPORTED_MEDIA_TYPE', 'Formats acceptés : JPEG, PNG, WebP'));
      return;
    }
    done(null, true);
  },
}).single('file');

/**
 * Réception d'une image de recette. Les erreurs de multer sont converties en
 * `AppError` pour que le client reçoive le format d'erreur habituel plutôt
 * qu'un 500 : dépassement de taille en 413, champ inattendu en 400.
 */
export function uploadRecipeImage(req: Request, res: Response, next: NextFunction): void {
  uploadImage(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMo = Math.round(env.UPLOAD_MAX_BYTES / (1024 * 1024));
        next(new AppError(413, 'FILE_TOO_LARGE', 'Image trop volumineuse (max ' + maxMo + ' Mo)'));
        return;
      }
      next(new AppError(400, 'INVALID_UPLOAD', 'Fichier invalide : ' + err.code));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    if (!req.file) {
      next(new AppError(400, 'FILE_REQUIRED', 'Aucun fichier reçu dans le champ « file »'));
      return;
    }
    next();
  });
}
