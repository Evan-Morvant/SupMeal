import type { Server } from 'socket.io';

/**
 * Point de diffusion partagé. Le contrôleur REST peut ainsi pousser dans le
 * salon sans rien connaître de Socket.io : un message envoyé en repli REST
 * arrive quand même aux clients connectés en WebSocket, et le module métier
 * ne dépend pas du bootstrap.
 */
let io: Server | null = null;

export function registerRealtimeServer(server: Server): void {
  io = server;
}

/** Nom du salon d'un cookbook, défini en un seul endroit. */
export function cookbookRoom(cookbookId: string): string {
  return 'cookbook:' + cookbookId;
}

/**
 * Diffuse un message aux membres présents dans le salon. Sans serveur temps
 * réel enregistré — tests REST, exécution sans WebSocket — l'appel ne fait
 * rien : le message est déjà persisté, la diffusion n'est qu'un supplément.
 */
export function broadcastMessage(cookbookId: string, payload: unknown): void {
  io?.to(cookbookRoom(cookbookId)).emit('message:new', payload);
}
