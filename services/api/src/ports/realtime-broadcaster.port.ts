import type { TierlistEvent } from '@tiermaster/shared';

/** Messages published after a commit; the Socket.IO gateway turns them into socket events. */
export type RealtimeMessage =
  /** A logged operation, broadcast to the tierlist room. */
  | { kind: 'tierlist.event'; event: TierlistEvent }
  /** Access may have changed: the gateway re-evaluates the role of the given users (all room members if omitted). */
  | { kind: 'access.changed'; tierlistId: string; userIds?: string[] }
  /** The tierlist no longer exists: everyone in the room is evicted. */
  | { kind: 'tierlist.deleted'; tierlistId: string }
  /** Per-user notification (e.g. a new pending invitation). */
  | { kind: 'user.notify'; userId: string; type: 'invitations.changed' };

/**
 * Port (ADR 0001): in-memory now, Redis pub/sub when the API runs on several instances.
 */
export interface RealtimeBroadcaster {
  publish(message: RealtimeMessage): void;
  subscribe(listener: (message: RealtimeMessage) => void): () => void;
}

export const REALTIME_BROADCASTER = Symbol('REALTIME_BROADCASTER');
