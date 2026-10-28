import { Inject, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  type AccessRevoked,
  type JoinAck,
  type Notification,
  JoinRequestSchema,
  LeaveRequestSchema,
  type Role,
  type RoleChanged,
  SOCKET_PATH,
  type TierlistEvent,
} from '@tiermaster/shared';
import type { DefaultEventsMap, RemoteSocket, Server, Socket } from 'socket.io';
import type { AuthUser } from '../../common/auth.js';
import { REALTIME_BROADCASTER, type RealtimeBroadcaster, type RealtimeMessage } from '../../ports/realtime-broadcaster.port.js';
import { AccessService } from '../access/access.service.js';
import { SessionService } from '../auth/session.service.js';
import { UsersService } from '../users/users.service.js';

interface SocketData {
  /** Resolves once the handshake token has been checked. */
  ready: Promise<void>;
  user: AuthUser | null;
  /** Effective role per joined tierlist, to detect changes on re-evaluation. */
  roles: Record<string, Role>;
}
interface ServerToClientEvents {
  event: (event: TierlistEvent) => void;
  'access.revoked': (payload: AccessRevoked) => void;
  'role.changed': (payload: RoleChanged) => void;
  notification: (payload: Notification) => void;
  auth_error: (payload: { code: string }) => void;
}
type TmServer = Server<DefaultEventsMap, ServerToClientEvents, DefaultEventsMap, SocketData>;
type TmSocket = Socket<DefaultEventsMap, ServerToClientEvents, DefaultEventsMap, SocketData>;
type TmRemoteSocket = RemoteSocket<ServerToClientEvents, SocketData>;

const tierlistRoom = (id: string) => `tierlist:${id}`;
const userRoom = (id: string) => `user:${id}`;

/**
 * Real-time gateway (real-time-collaboration.md): handles `join` / `leave` and emits events.
 * It accepts no modification; writes go through REST and arrive here through the RealtimeBroadcaster port.
 */
@WebSocketGateway({ path: SOCKET_PATH, serveClient: false })
export class TierlistGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() private readonly server!: TmServer;
  private readonly logger = new Logger(TierlistGateway.name);
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly access: AccessService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    @Inject(REALTIME_BROADCASTER) private readonly broadcaster: RealtimeBroadcaster,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.broadcaster.subscribe((message) => this.dispatch(message));
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  /** The token is optional (anonymous socket); a present but invalid token disconnects. */
  handleConnection(socket: TmSocket): void {
    socket.data.roles = {};
    socket.data.user = null;
    socket.data.ready = this.authenticate(socket);
  }

  @SubscribeMessage('join')
  async join(@ConnectedSocket() socket: TmSocket, @MessageBody() body: unknown): Promise<JoinAck> {
    await socket.data.ready;
    const request = JoinRequestSchema.safeParse(body);
    if (!request.success) return { ok: false, error: 'invalid' };
    const { tierlistId } = request.data;
    const ctx = await this.access.resolve(socket.data.user?.id ?? null, tierlistId);
    if (!ctx?.role) return { ok: false, error: 'not_found' };
    await socket.join(tierlistRoom(tierlistId));
    socket.data.roles[tierlistId] = ctx.role;
    return { ok: true, effectiveRole: ctx.role, rev: ctx.tierlist.rev };
  }

  @SubscribeMessage('leave')
  async leave(@ConnectedSocket() socket: TmSocket, @MessageBody() body: unknown): Promise<{ ok: boolean }> {
    const request = LeaveRequestSchema.safeParse(body);
    if (!request.success) return { ok: false };
    await socket.leave(tierlistRoom(request.data.tierlistId));
    delete socket.data.roles[request.data.tierlistId];
    return { ok: true };
  }

  private async authenticate(socket: TmSocket): Promise<void> {
    const token: unknown = socket.handshake.auth?.['token'];
    if (token === undefined || token === null || token === '') return;
    const userId = typeof token === 'string' ? this.sessions.verify(token, 'socket') : null;
    const user = userId ? await this.users.findById(userId) : null;
    if (!user || user.name === null) {
      socket.emit('auth_error', { code: 'invalid_token' });
      socket.disconnect(true);
      return;
    }
    socket.data.user = { id: user.id, name: user.name };
    await socket.join(userRoom(user.id));
  }

  private async dispatch(message: RealtimeMessage): Promise<void> {
    switch (message.kind) {
      case 'tierlist.event':
        this.server.to(tierlistRoom(message.event.tierlistId)).emit('event', message.event);
        return;
      case 'access.changed':
        return this.reevaluate(message.tierlistId, message.userIds);
      case 'tierlist.deleted': {
        const payload: AccessRevoked = { tierlistId: message.tierlistId, reason: 'deleted' };
        this.server.to(tierlistRoom(message.tierlistId)).emit('access.revoked', payload);
        this.server.in(tierlistRoom(message.tierlistId)).socketsLeave(tierlistRoom(message.tierlistId));
        return;
      }
      case 'user.notify':
        this.server.to(userRoom(message.userId)).emit('notification', { type: message.type });
        return;
    }
  }

  /**
   * Re-evaluates the role of connected sockets instead of evicting blindly: a removed member may still
   * read through defaultRole. No role left: `access.revoked` and removal from the room; changed role: `role.changed`.
   */
  private async reevaluate(tierlistId: string, userIds?: string[]): Promise<void> {
    const room = tierlistRoom(tierlistId);
    const sockets: TmRemoteSocket[] = await this.server.in(room).fetchSockets();
    const roles = new Map<string | null, Role | null>();
    for (const socket of sockets) {
      const userId = socket.data.user?.id ?? null;
      if (userIds && (userId === null || !userIds.includes(userId))) continue;
      if (!roles.has(userId)) roles.set(userId, (await this.access.resolve(userId, tierlistId))?.role ?? null);
      const role = roles.get(userId) ?? null;
      if (role === null) {
        const payload: AccessRevoked = { tierlistId, reason: 'revoked' };
        socket.emit('access.revoked', payload);
        socket.leave(room);
        delete socket.data.roles[tierlistId];
      } else if (socket.data.roles[tierlistId] !== role) {
        socket.data.roles[tierlistId] = role;
        const payload: RoleChanged = { tierlistId, effectiveRole: role };
        socket.emit('role.changed', payload);
      }
    }
    this.logger.debug(`Re-evaluated ${sockets.length} socket(s) on ${tierlistId}`);
  }
}
