import { Request, Response } from 'express';
import { slugify, stripBom } from '../../common/text';
import { findCookbookOrFail } from '../cookbooks/cookbooks.service';
import {
  buildCookbookExportPayload,
  buildExportPayload,
  buildRecipeExportPayload,
} from './export.service';
import { detectFormat, getFormat } from './formats';
import { importFile } from './import.service';
import type { ExportQuery, ImportBody } from './import-export.schemas';
import type { ExportPayload, RecipeFormat } from './import-export.types';

/**
 * Envoi d'un export : le fichier est daté et proposé en pièce jointe, quel que
 * soit son périmètre.
 */
function sendExport(
  res: Response,
  format: RecipeFormat,
  payload: ExportPayload,
  basename: string,
): void {
  const filename =
    'supmeal-' + basename + '-' + payload.exportedAt.slice(0, 10) + '.' + format.extension;

  res.setHeader('Content-Type', format.contentType);
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.send(format.serialize(payload));
}

export async function exportData(req: Request, res: Response): Promise<void> {
  const { format } = req.query as unknown as ExportQuery;
  const payload = await buildExportPayload(req.user!.id);
  sendExport(res, getFormat(format), payload, 'export');
}

/** La recette a déjà été chargée et autorisée par le middleware d'accès. */
export async function exportRecipe(req: Request, res: Response): Promise<void> {
  const { format } = req.query as unknown as ExportQuery;
  const recipe = req.recipe!;
  const payload = await buildRecipeExportPayload(req.user!.id, recipe);

  // Un titre fait de ponctuation ne donnerait pas de nom de fichier utilisable.
  sendExport(res, getFormat(format), payload, slugify(recipe.title) || 'recette');
}

/** L'appartenance au cookbook a déjà été vérifiée par la garde de rôle. */
export async function exportCookbook(req: Request, res: Response): Promise<void> {
  const { format } = req.query as unknown as ExportQuery;
  const cookbook = await findCookbookOrFail(req.membership!.cookbookId);
  const payload = await buildCookbookExportPayload(req.user!.id, cookbook);

  sendExport(res, getFormat(format), payload, slugify(cookbook.name) || 'cookbook');
}

export async function importData(req: Request, res: Response): Promise<void> {
  const text = stripBom(req.file!.buffer.toString('utf8'));
  const { format, withPreferences } = req.body as ImportBody;
  const recipeFormat = format === undefined ? detectFormat(text) : getFormat(format);

  const report = await importFile(req.user!.id, recipeFormat.parse(text), withPreferences);
  res.json({ format: recipeFormat.id, ...report });
}
