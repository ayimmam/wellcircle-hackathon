import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { createStoryMock } = vi.hoisted(() => ({ createStoryMock: vi.fn() }));

vi.mock('../api/client', () => ({ createStory: createStoryMock }));
vi.mock('../utils/imageCompress', () => ({
  // Pass the file straight through — compression itself is covered by
  // imageCompress.test.js.
  compressImage: vi.fn(async (file) => file),
  ImageTooLargeError: class ImageTooLargeError extends Error {},
}));

import useStoryUpload from '../hooks/useStoryUpload';

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('useStoryUpload', () => {
  beforeEach(() => {
    createStoryMock.mockReset();
    global.URL.createObjectURL = vi.fn(() => 'blob:local-preview');
  });

  it('calls onPending synchronously before the upload resolves', async () => {
    const d = deferred();
    createStoryMock.mockReturnValue(d.promise);
    const onPending = vi.fn();
    const { result } = renderHook(() => useStoryUpload({ onPending }));

    let uploadPromise;
    act(() => {
      uploadPromise = result.current.upload(new Blob(['x']));
    });
    // compressImage is async (a microtask), so flush one tick before
    // asserting — still well before the network call resolves.
    await act(async () => { await Promise.resolve(); });

    expect(onPending).toHaveBeenCalledWith(
      expect.objectContaining({ localUrl: 'blob:local-preview' })
    );

    d.resolve({ id: 'story-1' });
    await act(async () => { await uploadPromise; });
  });

  it('reports upload progress and calls onSuccess with the server story on success', async () => {
    let progressCb;
    createStoryMock.mockImplementation((_file, { onProgress }) => {
      progressCb = onProgress;
      return new Promise(resolve => {
        progressCb(50);
        resolve({ id: 'story-1', points_awarded: 20 });
      });
    });
    const onSuccess = vi.fn();
    const onProgress = vi.fn();
    const { result } = renderHook(() => useStoryUpload({ onProgress, onSuccess }));

    await act(async () => {
      await result.current.upload(new Blob(['x']));
    });

    expect(onProgress).toHaveBeenCalledWith(expect.any(String), 50);
    expect(onSuccess).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ id: 'story-1', points_awarded: 20 })
    );
  });

  it('calls onFailure with the same tempId on a rejected upload', async () => {
    createStoryMock.mockRejectedValue(new Error('network down'));
    const onPending = vi.fn();
    const onFailure = vi.fn();
    const { result } = renderHook(() => useStoryUpload({ onPending, onFailure }));

    await act(async () => {
      await result.current.upload(new Blob(['x']));
    });

    const tempId = onPending.mock.calls[0][0].tempId;
    expect(onFailure).toHaveBeenCalledWith(tempId, expect.any(Error));
  });

  it('retry() re-sends the same file that just failed, without a new pick', async () => {
    createStoryMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ id: 'story-2' });
    const onFailure = vi.fn();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useStoryUpload({ onFailure, onSuccess }));

    await act(async () => {
      await result.current.upload(new Blob(['x']));
    });
    expect(onFailure).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.retry();
    });
    expect(onSuccess).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ id: 'story-2' }));
    expect(createStoryMock).toHaveBeenCalledTimes(2);
  });
});
