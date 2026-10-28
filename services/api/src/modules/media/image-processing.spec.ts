import { sniffImageType } from './image-processing.js';

describe('sniffImageType', () => {
  it.each([
    ['jpeg', [0xff, 0xd8, 0xff, 0xe0]],
    ['png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ['gif', [...Buffer.from('GIF89a')]],
    ['webp', [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]],
  ])('detects %s', (type, bytes) => {
    expect(sniffImageType(Buffer.from(bytes))).toBe(type);
  });

  it.each([
    ['empty', []],
    ['pdf', [...Buffer.from('%PDF-1.7')]],
    ['svg', [...Buffer.from('<svg xmlns=')]],
    ['html', [...Buffer.from('<!doctype html>')]],
    ['riff but not webp', [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WAVE')]],
    ['truncated png', [0x89, 0x50, 0x4e]],
  ])('rejects %s', (_, bytes) => {
    expect(sniffImageType(Buffer.from(bytes))).toBeNull();
  });
});
