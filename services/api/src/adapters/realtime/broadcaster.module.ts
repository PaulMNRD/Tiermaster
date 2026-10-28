import { Global, Module } from '@nestjs/common';
import { REALTIME_BROADCASTER } from '../../ports/realtime-broadcaster.port.js';
import { InMemoryBroadcaster } from './in-memory-broadcaster.js';

@Global()
@Module({
  providers: [{ provide: REALTIME_BROADCASTER, useClass: InMemoryBroadcaster }],
  exports: [REALTIME_BROADCASTER],
})
export class BroadcasterModule {}
