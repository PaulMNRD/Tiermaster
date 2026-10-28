import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { type JoinAck, JoinAckSchema, ServerMessages, SOCKET_PATH } from '@tiermaster/shared';
import { io, type Socket } from 'socket.io-client';
import { AuthService } from '../auth/auth.service';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

/** One Socket.IO connection for the whole app. Rooms are not preserved across drops: listeners rejoin on reconnect. */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly window = inject(DOCUMENT).defaultView;
  private socket: Socket | null = null;
  private everConnected = false;
  private readonly reconnectListeners = new Set<() => void>();

  readonly status = signal<ConnectionStatus>('idle');

  connect(): Socket {
    if (this.socket) return this.socket;
    this.status.set('connecting');
    const socket = io({
      path: SOCKET_PATH,
      // A function, so every (re)connection sends a fresh short-lived token.
      auth: (cb) => void this.auth.socketToken().then((token) => cb(token ? { token } : {})),
    });
    socket.on('connect', () => {
      this.status.set('connected');
      if (this.everConnected) for (const listener of this.reconnectListeners) listener();
      this.everConnected = true;
    });
    socket.on('disconnect', (reason) => {
      this.status.set(this.window?.navigator.onLine === false ? 'offline' : 'reconnecting');
      // The server refused our token: refresh the session, then retry once.
      if (reason === 'io server disconnect') void this.auth.reload().then(() => socket.connect());
    });
    socket.on('connect_error', () => this.status.set(this.window?.navigator.onLine === false ? 'offline' : 'reconnecting'));
    this.window?.addEventListener('offline', () => this.status.set('offline'));
    this.window?.addEventListener('online', () => {
      if (!socket.connected) {
        this.status.set('reconnecting');
        socket.connect();
      }
    });
    this.socket = socket;
    return socket;
  }

  async join(tierlistId: string): Promise<JoinAck> {
    const ack = await this.connect().timeout(8000).emitWithAck('join', { tierlistId });
    return JoinAckSchema.parse(ack);
  }

  leave(tierlistId: string): void {
    this.socket?.emit('leave', { tierlistId });
  }

  /** Subscribes to a server message; returns the unsubscribe function. */
  on(name: (typeof ServerMessages)[keyof typeof ServerMessages], handler: (payload: unknown) => void): () => void {
    const socket = this.connect();
    socket.on(name, handler);
    return () => socket.off(name, handler);
  }

  onReconnect(handler: () => void): () => void {
    this.reconnectListeners.add(handler);
    return () => this.reconnectListeners.delete(handler);
  }

  /** Forces a reconnection attempt (used by the "retry" button of the connection indicator). */
  reconnect(): void {
    const socket = this.connect();
    if (!socket.connected) socket.connect();
  }
}
