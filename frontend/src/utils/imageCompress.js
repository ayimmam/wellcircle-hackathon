// Client-side image compression for anything posted straight off a phone
// camera — stories, posts, profile photos (WS1/WS2/WS9 of
// docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md). The server enforces the same
// ceiling as a backstop; this is what keeps a real upload from ever hitting
// it on a normal photo.

export class ImageTooLargeError extends Error {
  constructor(message = "That photo is too large to post, even compressed.") {
    super(message);
    this.name = 'ImageTooLargeError';
  }
}

/**
 * @param {File|Blob} file
 * @param {{maxBytes?: number, maxEdge?: number}} [options]
 * @returns {Promise<Blob>} a JPEG blob at or under `maxBytes`, or the
 *   original file unchanged if it's already small enough.
 */
export async function compressImage(file, { maxBytes = 2_000_000, maxEdge = 1440 } = {}) {
  if (!file) throw new ImageTooLargeError('No file given');
  if (file.size <= maxBytes) return file;

  const bitmap = await loadImage(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // Step quality down, then shrink the edge further, until it fits.
  const qualitySteps = [0.85, 0.7, 0.55, 0.4];
  for (const quality of qualitySteps) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob && blob.size <= maxBytes) return blob;
  }

  // Still too big — halve the edge once more and try the lowest quality.
  const smallerCanvas = document.createElement('canvas');
  smallerCanvas.width = Math.round(width / 2);
  smallerCanvas.height = Math.round(height / 2);
  smallerCanvas.getContext('2d').drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
  const lastTry = await canvasToBlob(smallerCanvas, 0.4);
  if (lastTry && lastTry.size <= maxBytes) return lastTry;

  throw new ImageTooLargeError();
}

function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  // Fallback for environments without createImageBitmap.
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
  });
}
