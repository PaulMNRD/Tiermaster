import { Inject, Injectable } from '@nestjs/common';
import type { EventPayload, TierlistEvent, TierlistEventType } from '@tiermaster/shared';
import { type Tx, TransactionRunner } from '../../adapters/prisma/transaction.runner.js';
import type { AuthUser } from '../../common/auth.js';
import { conflict } from '../../common/errors.js';
import { REALTIME_BROADCASTER, type RealtimeBroadcaster, type RealtimeMessage } from '../../ports/realtime-broadcaster.port.js';
import { type AccessContext, AccessService, type Authorization } from '../access/access.service.js';
import { OpsRepository } from './ops.repository.js';

export interface Change<T extends TierlistEventType = TierlistEventType> {
  type: T;
  payload: EventPayload<T>;
  /** Extra messages published after the commit (e.g. access re-evaluation). */
  after?: RealtimeMessage[];
}

export interface WriteRequest<T extends TierlistEventType> {
  user: AuthUser;
  tierlistId: string;
  authorize: Authorization;
  clientOpId?: string;
  apply: (tx: Tx, ctx: AccessContext) => Promise<Change<T>>;
}

/**
 * The write path of real-time-collaboration.md: one transaction holding the tierlist row lock
 * (permission check, data update, rev + 1, op log), then the event is published after the commit.
 * A retried `clientOpId` returns the original rev without applying the change twice.
 */
@Injectable()
export class TierlistWriter {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly access: AccessService,
    private readonly ops: OpsRepository,
    @Inject(REALTIME_BROADCASTER) private readonly broadcaster: RealtimeBroadcaster,
  ) {}

  async write<T extends TierlistEventType>(request: WriteRequest<T>): Promise<{ rev: number; duplicate: boolean }> {
    const outcome = await this.transactions.run(async (tx) => {
      const ctx = await this.access.lockAndAuthorize(tx, request.user, request.tierlistId, request.authorize);
      if (request.clientOpId) {
        const previous = await this.ops.findByClientOpId(tx, request.tierlistId, request.clientOpId);
        if (previous) {
          if (previous.authorId !== request.user.id) throw conflict('client_op_id_reused');
          return { rev: previous.rev, duplicate: true as const };
        }
      }
      const change = await request.apply(tx, ctx);
      const event = {
        tierlistId: request.tierlistId,
        rev: ctx.tierlist.rev + 1,
        clientOpId: request.clientOpId ?? null,
        authorId: request.user.id,
        type: change.type,
        payload: change.payload,
      } as TierlistEvent;
      await this.ops.append(tx, event);
      return { rev: event.rev, duplicate: false as const, event, after: change.after ?? [] };
    });

    if (!outcome.duplicate) {
      this.broadcaster.publish({ kind: 'tierlist.event', event: outcome.event });
      for (const message of outcome.after) this.broadcaster.publish(message);
    }
    return { rev: outcome.rev, duplicate: outcome.duplicate };
  }
}
