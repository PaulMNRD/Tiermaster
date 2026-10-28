import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type { RealtimeBroadcaster, RealtimeMessage } from '../../ports/realtime-broadcaster.port.js';

export class InMemoryBroadcaster implements RealtimeBroadcaster {
  private readonly emitter = new EventEmitter().setMaxListeners(0);
  private readonly logger = new Logger(InMemoryBroadcaster.name);

  publish(message: RealtimeMessage): void {
    // Listeners must never break the write that already committed.
    for (const listener of this.emitter.listeners('message')) {
      try {
        void Promise.resolve((listener as (m: RealtimeMessage) => unknown)(message)).catch((error: unknown) =>
          this.logger.error('Realtime listener failed', error as Error),
        );
      } catch (error) {
        this.logger.error('Realtime listener failed', error as Error);
      }
    }
  }

  subscribe(listener: (message: RealtimeMessage) => void): () => void {
    this.emitter.on('message', listener);
    return () => this.emitter.off('message', listener);
  }
}
