import { api } from '../api/client';

/*
 * Les exports sont servis en pièce jointe, derrière un jeton : un simple lien
 * ne porterait pas l'en-tête d'authentification. On récupère donc le fichier
 * par l'API, puis on déclenche l'enregistrement depuis un objet local.
 */

/** Nom de fichier annoncé par le serveur, à défaut celui qu'on propose. */
function filenameFrom(disposition: unknown, fallback: string): string {
  if (typeof disposition !== 'string') {
    return fallback;
  }
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return match === null ? fallback : match[1];
}

export async function downloadFromApi(
  path: string,
  fallbackName: string,
  params?: Record<string, string>,
): Promise<void> {
  const response = await api.get<Blob>(path, { params, responseType: 'blob' });
  const name = filenameFrom(response.headers['content-disposition'], fallbackName);

  const href = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Révoquer dans la foulée annulerait l'enregistrement dans certains navigateurs.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
