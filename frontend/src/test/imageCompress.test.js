import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressImage, ImageTooLargeError } from '../utils/imageCompress';

function fileOfSize(bytes, type = 'image/jpeg') {
  return new File([new Uint8Array(bytes)], 'photo.jpg', { type });
}

describe('compressImage', () => {
  beforeEach(() => {
    // happy-dom doesn't implement createImageBitmap/canvas rendering — stub
    // just enough of the pipeline to exercise compressImage's own logic
    // (the size-check loop), not the browser's actual image decoding.
    global.createImageBitmap = vi.fn().mockResolvedValue({ width: 3000, height: 2000, close: vi.fn() });
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() });
  });

  it('returns a small file unchanged, without touching the canvas pipeline', async () => {
    const small = fileOfSize(500_000);
    const result = await compressImage(small, { maxBytes: 2_000_000 });
    expect(result).toBe(small);
    expect(global.createImageBitmap).not.toHaveBeenCalled();
  });

  it('compresses a large file down to at or under the byte limit', async () => {
    let call = 0;
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb) {
      call += 1;
      // First couple of quality steps still "too big", then it fits.
      const size = call < 3 ? 3_000_000 : 1_500_000;
      cb(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }));
    });

    const large = fileOfSize(5_000_000);
    const result = await compressImage(large, { maxBytes: 2_000_000 });
    expect(result.size).toBeLessThanOrEqual(2_000_000);
  });

  it('throws ImageTooLargeError when it cannot get under the limit', async () => {
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb) {
      cb(new Blob([new Uint8Array(9_000_000)], { type: 'image/jpeg' }));
    });

    const huge = fileOfSize(20_000_000);
    await expect(compressImage(huge, { maxBytes: 2_000_000 })).rejects.toBeInstanceOf(ImageTooLargeError);
  });
});
