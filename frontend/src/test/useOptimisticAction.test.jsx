import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import useOptimisticAction from '../hooks/useOptimisticAction';
import ToastContainer from '../components/Toast';

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('useOptimisticAction', () => {
  it('runs apply() synchronously, before request() resolves', async () => {
    const { result } = renderHook(() => useOptimisticAction());
    const d = deferred();
    const apply = vi.fn();

    let promise;
    act(() => {
      promise = result.current({ apply, request: () => d.promise });
    });
    expect(apply).toHaveBeenCalledTimes(1); // already ran — no await needed

    await act(async () => { d.resolve('ok'); await promise; });
  });

  it('calls reconcile with the request result on success', async () => {
    const { result } = renderHook(() => useOptimisticAction());
    const reconcile = vi.fn();

    let outcome;
    await act(async () => {
      outcome = await result.current({
        apply: () => {},
        request: () => Promise.resolve({ count: 5 }),
        reconcile,
      });
    });

    expect(reconcile).toHaveBeenCalledWith({ count: 5 });
    expect(outcome).toEqual({ ok: true, result: { count: 5 } });
  });

  it('calls undo() and reports failure once on rejection', async () => {
    render(<ToastContainer />);
    const { result } = renderHook(() => useOptimisticAction());
    const undo = vi.fn();

    let outcome;
    await act(async () => {
      outcome = await result.current({
        apply: () => undo,
        request: () => Promise.reject(new Error('nope')),
        failureMessage: 'Could not do the thing',
      });
    });

    expect(undo).toHaveBeenCalledTimes(1);
    expect(outcome.ok).toBe(false);
    expect(screen.getByText('Could not do the thing')).toBeInTheDocument();
  });

  it('fails silently (no toast) when failureMessage is omitted', async () => {
    const { container } = render(<ToastContainer />);
    const { result } = renderHook(() => useOptimisticAction());

    await act(async () => {
      await result.current({
        apply: () => {},
        request: () => Promise.reject(new Error('nope')),
      });
    });

    expect(container.querySelector('.toast-container')).toBeNull();
  });

  it('a second call with the same dedupeKey while the first is in flight is skipped', async () => {
    const { result } = renderHook(() => useOptimisticAction());
    const d = deferred();
    const request = vi.fn(() => d.promise);

    let first, second;
    act(() => {
      first = result.current({ apply: () => {}, request, dedupeKey: 'post-1' });
      second = result.current({ apply: () => {}, request, dedupeKey: 'post-1' });
    });

    await act(async () => {
      d.resolve('ok');
      await Promise.all([first, second]);
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(await second).toMatchObject({ skipped: true });
  });

  it('a different dedupeKey is not blocked by another in-flight action', async () => {
    const { result } = renderHook(() => useOptimisticAction());
    const request = vi.fn(() => Promise.resolve('ok'));

    let a, b;
    await act(async () => {
      a = result.current({ apply: () => {}, request, dedupeKey: 'post-1' });
      b = result.current({ apply: () => {}, request, dedupeKey: 'post-2' });
      await Promise.all([a, b]);
    });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('the same dedupeKey can run again once the first call has settled', async () => {
    const { result } = renderHook(() => useOptimisticAction());
    const request = vi.fn(() => Promise.resolve('ok'));

    await act(async () => {
      await result.current({ apply: () => {}, request, dedupeKey: 'post-1' });
    });
    await act(async () => {
      await result.current({ apply: () => {}, request, dedupeKey: 'post-1' });
    });

    expect(request).toHaveBeenCalledTimes(2);
  });
});
