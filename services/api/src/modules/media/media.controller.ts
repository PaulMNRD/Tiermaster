import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { type AuthUser, CurrentUser, RequireUser } from '../../common/auth.js';
import { apiError, notFound } from '../../common/errors.js';
import { RateLimit } from '../../common/rate-limit.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import type { StoredObject } from '../../ports/object-storage.port.js';
import { MAX_UPLOAD_BYTES } from './image-processing.js';
import { MediaService } from './media.service.js';

/** Multer keeps the file in memory (Nest default); the size limit applies while receiving. */
const upload = () => FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

/** The part of a Multer file we use (avoids depending on Multer's global types). */
interface UploadedImage {
  buffer: Buffer;
}

class ImageFilePipe {
  transform(value: unknown): string {
    if (typeof value !== 'string' || !/^[0-9a-f-]{36}\.webp$/.test(value)) throw notFound();
    return value;
  }
}

function requireFile(file: UploadedImage | undefined): Buffer {
  if (!file) throw apiError(HttpStatus.BAD_REQUEST, 'file_missing');
  return file.buffer;
}

function send(res: Response, object: StoredObject, cacheControl: string): void {
  res.setHeader('Content-Type', object.contentType);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.send(object.body);
}

@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('tierlists/:id/media')
  @RequireUser()
  @RateLimit('upload')
  @UseInterceptors(upload())
  uploadCardImage(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<{ imageKey: string }> {
    return this.media.uploadCardImage(user, id, requireFile(file));
  }

  @Get('media/tierlists/:id/:file')
  async readCardImage(
    @CurrentUser() user: AuthUser | null,
    @Param('id', UuidPipe) id: string,
    @Param('file', ImageFilePipe) file: string,
    @Res() res: Response,
  ): Promise<void> {
    // Private: a revoked user must not keep reading from a shared cache.
    send(res, await this.media.readCardImage(user, id, file), 'private, max-age=300');
  }

  @Post('me/avatar')
  @RequireUser()
  @RateLimit('upload')
  @UseInterceptors(upload())
  async uploadAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedImage | undefined): Promise<void> {
    await this.media.uploadAvatar(user, requireFile(file));
  }

  @Delete('me/avatar')
  @RequireUser()
  @HttpCode(204)
  async removeAvatar(@CurrentUser() user: AuthUser): Promise<void> {
    await this.media.removeAvatar(user);
  }

  @Get('users/:id/avatar')
  async readAvatar(@Param('id', UuidPipe) id: string, @Res() res: Response): Promise<void> {
    // The URL carries a version (?v=key), so a long public cache is safe.
    send(res, await this.media.readAvatar(id), 'public, max-age=86400');
  }
}
