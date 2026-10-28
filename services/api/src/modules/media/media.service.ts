import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../../common/auth.js';
import { notFound } from '../../common/errors.js';
import { OBJECT_STORAGE, type ObjectStorage, type StoredObject } from '../../ports/object-storage.port.js';
import { AccessService } from '../access/access.service.js';
import { UsersService } from '../users/users.service.js';
import { reencodeImage } from './image-processing.js';

const CARD_IMAGE_SIZE = 512;
const AVATAR_SIZE = 256;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly access: AccessService,
    private readonly users: UsersService,
  ) {}

  /** EDITOR and above; the key is random and namespaced by tierlist. */
  async uploadCardImage(user: AuthUser, tierlistId: string, file: Buffer): Promise<{ imageKey: string }> {
    await this.access.authorize(user, tierlistId, 'media.upload');
    const image = await reencodeImage(file, CARD_IMAGE_SIZE);
    const imageKey = `tierlists/${tierlistId}/${randomUUID()}.webp`;
    await this.storage.put(imageKey, image, 'image/webp');
    return { imageKey };
  }

  /** Same read check as the tierlist itself: revocation applies to images immediately. */
  async readCardImage(user: AuthUser | null, tierlistId: string, file: string): Promise<StoredObject> {
    await this.access.authorize(user, tierlistId, 'tierlist.read');
    const object = await this.storage.get(`tierlists/${tierlistId}/${file}`);
    if (!object) throw notFound();
    return object;
  }

  async uploadAvatar(user: AuthUser, file: Buffer): Promise<void> {
    const image = await reencodeImage(file, AVATAR_SIZE);
    const key = `avatars/${user.id}/${randomUUID()}.webp`;
    await this.storage.put(key, image, 'image/webp');
    const previous = await this.users.setAvatarKey(user.id, key);
    if (previous) this.discard(previous);
  }

  async removeAvatar(user: AuthUser): Promise<void> {
    const previous = await this.users.setAvatarKey(user.id, null);
    if (previous) this.discard(previous);
  }

  /** Avatars are public profile data. */
  async readAvatar(userId: string): Promise<StoredObject> {
    const key = await this.users.avatarKey(userId);
    const object = key ? await this.storage.get(key) : null;
    if (!object) throw notFound();
    return object;
  }

  private discard(key: string): void {
    this.storage.delete(key).catch((error: unknown) => this.logger.warn(`Could not delete ${key}: ${String(error)}`));
  }
}
