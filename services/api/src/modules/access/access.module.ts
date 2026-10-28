import { Module } from '@nestjs/common';
import { AccessRepository } from './access.repository.js';
import { AccessService } from './access.service.js';

@Module({ providers: [AccessService, AccessRepository], exports: [AccessService] })
export class AccessModule {}
