import { Request, Response } from 'express';
import {
  serializeCreatedInvitation,
  serializeInvitation,
  serializeMembership,
} from '../../common/serialize';
import * as invitationsService from './invitations.service';

export async function invite(req: Request, res: Response): Promise<void> {
  const created = await invitationsService.inviteMember(req.membership!.cookbookId, req.body);
  res.status(201).json(serializeCreatedInvitation(created));
}

export async function list(req: Request, res: Response): Promise<void> {
  const invitations = await invitationsService.listInvitations(req.membership!.cookbookId);
  res.json(invitations.map(serializeInvitation));
}

export async function revoke(req: Request, res: Response): Promise<void> {
  await invitationsService.revokeInvitation(req.membership!.cookbookId, req.params.invId);
  res.status(204).send();
}

export async function accept(req: Request, res: Response): Promise<void> {
  const membership = await invitationsService.acceptInvitation(req.user!.id, req.params.token);
  res.json(serializeMembership(membership));
}

export async function decline(req: Request, res: Response): Promise<void> {
  await invitationsService.declineInvitation(req.user!.id, req.params.token);
  res.status(204).send();
}
