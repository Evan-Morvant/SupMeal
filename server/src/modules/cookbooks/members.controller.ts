import { Request, Response } from 'express';
import { serializeMembership } from '../../common/serialize';
import * as membersService from './members.service';

export async function list(req: Request, res: Response): Promise<void> {
  const members = await membersService.listMembers(req.membership!.cookbookId);
  res.json(members.map(serializeMembership));
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  const membership = await membersService.updateMemberRole(
    req.membership!.cookbookId,
    req.params.userId,
    req.body.role,
  );
  res.json(serializeMembership(membership));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await membersService.removeMember(req.membership!.cookbookId, req.params.userId);
  res.status(204).send();
}

export async function leave(req: Request, res: Response): Promise<void> {
  await membersService.removeMember(req.membership!.cookbookId, req.user!.id);
  res.status(204).send();
}
