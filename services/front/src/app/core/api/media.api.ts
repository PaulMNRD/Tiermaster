import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import { resizeImage } from '../media/image-resize';

const UploadResultSchema = z.object({ imageKey: z.string() });

@Injectable({ providedIn: 'root' })
export class MediaApi {
  private readonly http = inject(HttpClient);

  /** Resizes in the browser, then uploads; returns the key to put on a card. */
  async uploadCardImage(tierlistId: string, file: File): Promise<string> {
    const body = new FormData();
    body.append('file', await resizeImage(file), 'image');
    return UploadResultSchema.parse(await firstValueFrom(this.http.post(`/api/tierlists/${tierlistId}/media`, body))).imageKey;
  }

  async uploadAvatar(file: File): Promise<void> {
    const body = new FormData();
    body.append('file', await resizeImage(file, 512), 'avatar');
    await firstValueFrom(this.http.post('/api/me/avatar', body));
  }

  async removeAvatar(): Promise<void> {
    await firstValueFrom(this.http.delete('/api/me/avatar'));
  }
}
