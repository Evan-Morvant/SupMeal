import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { uploadImportFile } from '../../middlewares/upload';
import { validateBody, validateQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import * as importExportController from './import-export.controller';
import { exportQuerySchema, importBodySchema } from './import-export.schemas';

/**
 * Import et export des données de l'utilisateur connecté. Les deux routes sont
 * montées à la racine de l'API.
 */
export const importExportRouter = Router();

importExportRouter.get(
  '/export',
  authenticate,
  validateQuery(exportQuerySchema),
  asyncHandler(importExportController.exportData),
);

// L'analyse du fichier précède la validation : les champs d'un envoi
// multipart n'existent dans `req.body` qu'une fois multer passé.
importExportRouter.post(
  '/import',
  authenticate,
  uploadImportFile,
  validateBody(importBodySchema),
  asyncHandler(importExportController.importData),
);
