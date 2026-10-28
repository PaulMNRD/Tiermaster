import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorSchema } from '@tiermaster/shared';

export interface ApiFailure {
  /** HTTP status, 0 for a network error. */
  status: number;
  /** Machine-readable code from the API (`not_found`, `pseudonym_taken`, ...), or `network_error` / `unknown`. */
  code: string;
}

/** Normalizes any thrown value from HttpClient into `{ status, code }`. */
export function toApiFailure(error: unknown): ApiFailure {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return { status: 0, code: 'network_error' };
    const body = ApiErrorSchema.safeParse(error.error);
    return { status: error.status, code: body.success ? body.data.code : 'unknown' };
  }
  return { status: 0, code: 'unknown' };
}
