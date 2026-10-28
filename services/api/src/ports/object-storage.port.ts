/** Port (ADR 0001, ADR 0008): Garage through the plain S3 API now, any S3 service later. */
export interface StoredObject {
  body: Buffer;
  contentType: string;
}

export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Returns null when the object does not exist. */
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
