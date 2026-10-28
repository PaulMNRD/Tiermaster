import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { ContentController } from './content.controller.js';
import { ContentRepository } from './content.repository.js';
import { ContentService } from './content.service.js';
import { OpsRepository } from './ops.repository.js';
import { TierlistWriter } from './tierlist-writer.service.js';
import { TierlistsController } from './tierlists.controller.js';
import { TierlistsRepository } from './tierlists.repository.js';
import { TierlistsService } from './tierlists.service.js';

@Module({
  imports: [AccessModule],
  controllers: [TierlistsController, ContentController],
  providers: [TierlistsService, ContentService, ContentRepository, TierlistsRepository, TierlistWriter, OpsRepository],
  exports: [TierlistWriter, ContentService],
})
export class TierlistsModule {}
