import { z } from 'zod';

/** Error body returned by every API error: `{ statusCode, code, message }`. */
export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  code: z.string(),
  message: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
