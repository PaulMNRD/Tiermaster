import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { OpsRepository } from './ops.repository.js';
import { TierlistWriter } from './tierlist-writer.service.js';
import { TierlistsController } from './tierlists.controller.js';
import { TierlistsRepository } from './tierlists.repository.js';
import { TierlistsService } from './tierlists.service.js';

@Module({
  imports: [AccessModule],
  controllers: [TierlistsController],
  providers: [TierlistsService, TierlistsRepository, TierlistWriter, OpsRepository],
  exports: [TierlistWriter],
})
export class TierlistsModule {}
