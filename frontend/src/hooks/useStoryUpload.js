import { useCallback, useRef } from 'react';
import { compressImage, ImageTooLargeError } from '../utils/imageCompress';
import { createStory } from '../api/client';
import { showToast } from '../components/Toast';
import { logIssue } from '../utils/log';

/**
 * Compress-then-upload a story, optimistically: the caller shows the photo
 * in the rail via a local blob URL the instant it's picked (`onPending`),
 * the upload happens in the background, and the caller reconciles
 * (`onSuccess`) or shows a failed/retry state (`onFailure`).
 *
 * This hook owns no DOM — the caller wires its own `<input type="file">`
 * and calls `upload(file)` from its `onChange`.
 *
 * @param {{onPending?: (info: {tempId: string, localUrl: string}) => void,
 *          onProgress?: (tempId: string, pct: number) => void,
 *          onSuccess?: (tempId: string, story: object) => void,
 *          onFailure?: (tempId: string, err: Error) => void}} handlers
 */
export default function useStoryUpload({ onPending, onProgress, onSuccess, onFailure } = {}) {
  // Kept so a failed upload can be retried without re-picking the file.
  const lastBlobRef = useRef(null);
  const lastTempIdRef = useRef(null);

  const send = useCallback((tempId, blob) => {
    lastBlobRef.current = blob;
    lastTempIdRef.current = tempId;
    return createStory(blob, { onProgress: pct => onProgress?.(tempId, pct) })
      .then(result => onSuccess?.(tempId, result))
      .catch(err => {
        logIssue('story_upload_failed', { message: err?.message });
        onFailure?.(tempId, err);
      });
  }, [onProgress, onSuccess, onFailure]);

  const upload = useCallback(async (file) => {
    let compressed;
    try {
      compressed = await compressImage(file, { maxBytes: 2_000_000 });
    } catch (err) {
      const message = err instanceof ImageTooLargeError
        ? err.message
        : 'Could not read that photo.';
      showToast(message, 'error');
      logIssue('story_compress_failed', { message: err?.message });
      return;
    }

    const tempId = `pending-${Date.now()}`;
    const localUrl = URL.createObjectURL(compressed);
    onPending?.({ tempId, localUrl });
    await send(tempId, compressed);
  }, [onPending, send]);

  const retry = useCallback(() => {
    if (!lastBlobRef.current || !lastTempIdRef.current) return;
    onProgress?.(lastTempIdRef.current, 0);
    send(lastTempIdRef.current, lastBlobRef.current);
  }, [send, onProgress]);

  return { upload, retry };
}
