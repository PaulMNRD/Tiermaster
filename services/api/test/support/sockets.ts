import { type JoinAck, SOCKET_PATH } from '@tiermaster/shared';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import type { TestApp } from './app.js';
import type { TestUser } from './fixtures.js';

export interface TestSocket {
  socket: Socket;
  /** Every message received, by name. */
  received: Map<string, unknown[]>;
  join(tierlistId: string): Promise<JoinAck>;
  /** Resolves with the next message of that name (or rejects after a timeout). */
  next<T = unknown>(name: string, timeoutMs?: number): Promise<T>;
  close(): void;
}

/** Connects a Socket.IO client, authenticated with a fresh socket token when a user is given. */
export async function connect(t: TestApp, user: TestUser | null, tokenOverride?: string): Promise<TestSocket> {
  let token = tokenOverride;
  if (user && token === undefined) {
    const res = await request(t.app.getHttpServer()).get('/api/auth/socket-token').set('Cookie', user.cookie).expect(200);
    token = res.body.token;
  }
  const socket = io(t.url, { path: SOCKET_PATH, transports: ['websocket'], auth: token ? { token } : {}, reconnection: false });
  const received = new Map<string, unknown[]>();
  const waiters = new Map<string, ((value: unknown) => void)[]>();
  const record = (name: string, payload: unknown) => {
    const queue = waiters.get(name);
    if (queue?.length) queue.shift()!(payload);
    else received.set(name, [...(received.get(name) ?? []), payload]);
  };
  socket.onAny(record);
  // Reserved events are not seen by onAny; the reason is recorded as a `disconnect` message.
  socket.on('disconnect', (reason) => record('disconnect', reason));
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return {
    socket,
    received,
    join: (tierlistId) => socket.timeout(2000).emitWithAck('join', { tierlistId }) as Promise<JoinAck>,
    next: <T>(name: string, timeoutMs = 2000) => {
      const buffered = received.get(name);
      if (buffered?.length) return Promise.resolve(buffered.shift() as T);
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`No "${name}" within ${timeoutMs}ms`)), timeoutMs);
        waiters.set(name, [...(waiters.get(name) ?? []), (value) => (clearTimeout(timer), resolve(value as T))]);
      });
    },
    close: () => socket.close(),
  };
}

/** Waits a bit and asserts that nothing named `name` arrived. */
export async function expectSilence(client: TestSocket, name: string, ms = 300): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  expect(client.received.get(name) ?? []).toEqual([]);
}
