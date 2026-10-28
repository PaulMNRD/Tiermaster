import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { notFound } from './errors.js';

const Uuid = z.uuid();

/** Route ids: a malformed id is reported like an unknown one (404). */
export class UuidPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const result = Uuid.safeParse(value);
    if (!result.success) throw notFound();
    return result.data;
  }
}
