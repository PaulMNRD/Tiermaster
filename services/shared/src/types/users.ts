import { z } from 'zod';

/** Pseudonym rules: 3 to 24 letters, digits, '_', '-' or '.'. Compared case-insensitively. */
export const PseudonymSchema = z
  .string()
  .trim()
  .regex(/^[\p{L}\p{N}_.-]{3,24}$/u, 'pseudonym_invalid');

export const UpdateMeSchema = z.object({ name: PseudonymSchema }).strict();
export type UpdateMe = z.infer<typeof UpdateMeSchema>;

export const MeSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  /** True until the user picks a pseudonym on first login. */
  needsPseudonym: z.boolean(),
});
export type Me = z.infer<typeof MeSchema>;

/** Public profile: email is never exposed. */
export const PublicUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const AuthProviderIdSchema = z.enum(['google', 'discord', 'steam', 'fake']);
export type AuthProviderId = z.infer<typeof AuthProviderIdSchema>;

export const AuthProvidersResponseSchema = z.object({ providers: z.array(AuthProviderIdSchema) });
export type AuthProvidersResponse = z.infer<typeof AuthProvidersResponseSchema>;

export const SocketTokenResponseSchema = z.object({ token: z.string() });
export type SocketTokenResponse = z.infer<typeof SocketTokenResponseSchema>;
