import path from 'path';
import { env } from '../config/env';

/** Préfixe public sous lequel l'API sert le contenu de `UPLOAD_DIR`. */
export const UPLOADS_ROUTE = '/uploads';

export const RECIPE_IMAGE_DIR = path.join(env.UPLOAD_DIR, 'recipes');

/** Chemin public d'une image, tel que stocké en base (relatif, donc portable). */
export function recipeImagePath(filename: string): string {
  return UPLOADS_ROUTE + '/recipes/' + filename;
}

/** Chemin disque correspondant à un chemin public déjà stocké. */
export function recipeImageDiskPath(publicPath: string): string {
  return path.join(env.UPLOAD_DIR, publicPath.replace(UPLOADS_ROUTE + '/', ''));
}
