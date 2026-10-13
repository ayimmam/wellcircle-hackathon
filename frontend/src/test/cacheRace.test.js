import { describe, expect, it } from 'vitest';
import { cached, peek, write } from '../api/cache';

describe('response cache races', () => {
  it('keeps a newer notification count when an older request finishes later', async () => {
    let finish;
    const request = cached('unread', () => new Promise(resolve => { finish = resolve; }));
    write('unread', 1);
    finish(0);
    expect(await request).toBe(1);
    expect(peek('unread')?.data).toBe(1);
  });
});
