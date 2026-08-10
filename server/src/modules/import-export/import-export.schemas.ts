import { z } from 'zod';
import { booleanParam } from '../../common/schemas';
import { FORMAT_IDS } from './import-export.types';

/** Schémas de validation du module import/export. */

/** Le format natif est proposé par défaut : c'est le plus complet. */
export const exportQuerySchema = z.object({
  format: z.enum(FORMAT_IDS).default('json'),
});

/**
 * À l'import, le format reste facultatif : omis, il est déduit du contenu du
 * fichier. L'indiquer sert à lever l'ambiguïté sur un fichier atypique.
 *
 * `withPreferences` est faux par défaut : reprendre les préférences du fichier
 * écrase celles du compte, ce qui doit rester un geste délibéré.
 */
export const importBodySchema = z.object({
  format: z.enum(FORMAT_IDS).optional(),
  withPreferences: booleanParam.default('false'),
});

export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type ImportBody = z.infer<typeof importBodySchema>;
