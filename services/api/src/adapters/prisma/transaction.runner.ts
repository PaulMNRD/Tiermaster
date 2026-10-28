import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

export type Tx = Prisma.TransactionClient;

/** Lets services open a transaction without depending on Prisma; repositories receive the `tx`. */
@Injectable()
export class TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, { timeout: 15_000, maxWait: 10_000 });
  }
}
