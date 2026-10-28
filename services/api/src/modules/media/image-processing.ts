import { HttpStatus } from '@nestjs/common';
import sharp from 'sharp';
import { apiError } from '../../common/errors.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Rejects decompression bombs before decoding them. */
const MAX_INPUT_PIXELS = 40_000_000;

export type ImageType = 'jpeg' | 'png' | 'gif' | 'webp';

/** Real type from the magic bytes; the declared MIME type and file name are ignored. */
export function sniffImageType(buffer: Buffer): ImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString('latin1'))) return 'gif';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'webp';
  }
  return null;
}

/**
 * Server-side pipeline (ADR 0003): never trusts the client. Checks the real type, then re-encodes to WebP,
 * which drops metadata (EXIF, GPS) and anything hidden in the original file.
 */
export async function reencodeImage(buffer: Buffer, maxSize: number): Promise<Buffer> {
  if (!sniffImageType(buffer)) throw apiError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'unsupported_type');
  try {
    return await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, animated: false, failOn: 'error' })
      .rotate()
      .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw apiError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'invalid_image');
  }
}
