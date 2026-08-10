import crypto from 'crypto';
import fs from 'fs';
import { NextFunction, Request, RequestHandler, Response } from 'express';
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

/**
 * Types acceptés pour un fichier d'import. `application/octet-stream` couvre
 * les navigateurs et clients qui ne reconnaissent pas l'extension du fichier
 * choisi ; le contenu est de toute façon analysé ensuite.
 */
const ALLOWED_IMPORT_TYPES = [
  'application/json',
  'text/json',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/octet-stream',
];

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

/**
 * Réception d'un fichier unique. Les erreurs de multer sont converties en
 * `AppError` pour que le client reçoive le format d'erreur habituel plutôt
 * qu'un 500 : dépassement de taille en 413, champ inattendu en 400. L'absence
 * de fichier est une erreur ici : ces routes n'existent que pour en recevoir un.
 */
function receiveFile(upload: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    upload(req, res, (err: unknown) => {
      if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const maxMo = Math.round(env.UPLOAD_MAX_BYTES / (1024 * 1024));
          next(new AppError(413, 'FILE_TOO_LARGE', 'Fichier trop volumineux (max ' + maxMo + ' Mo)'));
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
  };
}

/** Image de recette : écrite sur le disque, servie ensuite en statique. */
export const uploadRecipeImage = receiveFile(
  multer({
    storage,
    limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, done) => {
      if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
        done(new AppError(400, 'UNSUPPORTED_MEDIA_TYPE', 'Formats acceptés : JPEG, PNG, WebP'));
        return;
      }
      done(null, true);
    },
  }).single('file'),
);

/**
 * Fichier d'import : gardé en mémoire, jamais écrit sur le disque. Il n'a
 * d'utilité que le temps de la requête, et son contenu - des données
 * personnelles en clair - n'a aucune raison de subsister sur le serveur.
 */
export const uploadImportFile = receiveFile(
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, done) => {
      if (!ALLOWED_IMPORT_TYPES.includes(file.mimetype)) {
        done(
          new AppError(400, 'UNSUPPORTED_MEDIA_TYPE', 'Formats acceptés : JSON, CSV'),
        );
        return;
      }
      done(null, true);
    },
  }).single('file'),
);
