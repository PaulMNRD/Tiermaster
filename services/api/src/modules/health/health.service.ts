import { Injectable } from '@nestjs/common';
import { HealthRepository } from './health.repository.js';

@Injectable()
export class HealthService {
  constructor(private readonly repository: HealthRepository) {}

  async check(): Promise<{ status: 'ok' | 'degraded'; database: 'up' | 'down' }> {
    try {
      await this.repository.ping();
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}
