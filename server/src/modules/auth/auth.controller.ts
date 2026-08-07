import { Request, Response } from 'express';
import { serializeUser } from '../../common/serialize';
import { getUserOrFail } from '../users/users.service';
import * as authService from './auth.service';

export async function register(req: Request, res: Response): Promise<void> {
  const tokens = await authService.register(req.body);
  res.status(201).json(tokens);
}

export async function login(req: Request, res: Response): Promise<void> {
  const tokens = await authService.login(req.body);
  res.json(tokens);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const tokens = await authService.refresh(req.body.refreshToken);
  res.json(tokens);
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(req.body.refreshToken);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await getUserOrFail(req.user!.id);
  res.json(serializeUser(user));
}
