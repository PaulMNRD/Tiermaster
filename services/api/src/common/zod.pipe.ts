import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { apiError } from './errors.js';

/** Validates an incoming payload (body, query, params) with a schema from @tiermaster/shared. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const message = result.error.issues.map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`).join('; ');
      throw apiError(HttpStatus.BAD_REQUEST, 'validation_error', message);
    }
    return result.data;
  }
}
