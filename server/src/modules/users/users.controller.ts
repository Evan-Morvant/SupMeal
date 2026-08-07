import { Request, Response } from 'express';
import {
  serializeOAuthAccount,
  serializeUser,
  serializeUserPreferences,
} from '../../common/serialize';
import { AppError } from '../../common/app-error';
import { isOAuthProvider } from '../../models/oauth-account.model';
import { assertProvider, buildLinkUrl } from '../auth/oauth.controller';
import * as usersService from './users.service';

export async function getProfile(req: Request, res: Response): Promise<void> {
  const user = await usersService.getUserOrFail(req.user!.id);
  res.json(serializeUser(user));
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const user = await usersService.updateProfile(req.user!.id, req.body);
  res.json(serializeUser(user));
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  await usersService.changePassword(req.user!.id, req.body);
  res.status(204).send();
}

export async function getPreferences(req: Request, res: Response): Promise<void> {
  const preferences = await usersService.getPreferences(req.user!.id);
  res.json(serializeUserPreferences(preferences));
}

export async function replacePreferences(req: Request, res: Response): Promise<void> {
  const preferences = await usersService.replacePreferences(req.user!.id, req.body);
  res.json(serializeUserPreferences(preferences));
}

export async function listOAuthAccounts(req: Request, res: Response): Promise<void> {
  const accounts = await usersService.listOAuthAccounts(req.user!.id);
  res.json(accounts.map(serializeOAuthAccount));
}

/**
 * Renvoie l'URL d'autorisation plutôt qu'une redirection : la requête est
 * authentifiée par en-tête, la SPA pousse ensuite le navigateur dessus.
 */
export async function startOAuthLink(req: Request, res: Response): Promise<void> {
  const { provider } = req.params;
  assertProvider(provider);
  res.json({ authorizationUrl: buildLinkUrl(provider, req.user!.id) });
}

/**
 * La déliaison ne vérifie pas que le provider est encore configuré : un compte
 * lié doit rester détachable même si le serveur a perdu ses identifiants OAuth.
 */
export async function unlinkOAuthAccount(req: Request, res: Response): Promise<void> {
  const { provider } = req.params;
  if (!isOAuthProvider(provider)) {
    throw new AppError(404, 'UNKNOWN_PROVIDER', 'Provider OAuth inconnu');
  }
  await usersService.unlinkOAuthAccount(req.user!.id, provider);
  res.status(204).send();
}
