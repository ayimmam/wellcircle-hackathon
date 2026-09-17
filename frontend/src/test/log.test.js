import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('logIssue', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('always logs to the console, tagged, even without analytics configured', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logIssue } = await import('../utils/log');
    logIssue('timeout', { apiBase: 'https://api.example.com' });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toContain('[WellCircle]');
    expect(consoleSpy.mock.calls[0][0]).toContain('timeout');
    expect(consoleSpy.mock.calls[0][1]).toMatchObject({ apiBase: 'https://api.example.com' });
    consoleSpy.mockRestore();
  });

  it('never throws when analytics is unset (mock/test mode)', async () => {
    const { logIssue } = await import('../utils/log');
    expect(() => logIssue('offline')).not.toThrow();
    expect(() => logIssue('offline', undefined)).not.toThrow();
  });
});
