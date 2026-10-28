/** Largest side sent to the server; it re-encodes to 512 px anyway, this only saves bandwidth. */
export const MAX_UPLOAD_SIDE = 1024;

/** Dimensions scaled down (never up) to fit in a `max` × `max` box, keeping the ratio. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Resizes and compresses an image in the browser before upload (ADR 0003).
 * Falls back to the original file when the browser cannot decode it; the server validates anyway.
 */
export async function resizeImage(file: Blob, max = MAX_UPLOAD_SIDE): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  return blob && blob.size < file.size ? blob : file;
}
