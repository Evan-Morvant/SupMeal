import { Request, Response } from 'express';
import * as personalDataService from './personal-data.service';

/**
 * Le fichier est proposé en pièce jointe, comme les exports de contenu : c'est
 * une copie qu'on emporte, pas une page qu'on consulte.
 */
export async function download(req: Request, res: Response): Promise<void> {
  const data = await personalDataService.buildPersonalData(req.user!.id);
  const filename = 'supmeal-donnees-' + data.exportedAt.slice(0, 10) + '.json';

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.send(JSON.stringify(data, null, 2));
}
