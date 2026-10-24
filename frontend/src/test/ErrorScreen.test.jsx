import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorScreen from '../components/ErrorScreen';
import '../i18n';

afterEach(() => { delete window.Telegram; });

describe('ErrorScreen', () => {
  it.each([
    [{ status: 401 }, /signed in again/],
    [{ status: 403 }, /restricted/],
    [{ status: 404 }, /couldn’t find/],
    [{ status: 429 }, /breather/],
    [{ status: 503 }, /little pause/],
    [Object.assign(new Error(''), { isNetworkNoise: true }), /reconnect/],
    [{ cause: { name: 'AbortError' } }, /taking a little longer/],
  ])('explains a failure safely: %j', (failure, heading) => {
    render(<ErrorScreen error={{ ...failure, message: 'secret backend details' }} />);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.queryByText(/secret backend details/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact support/i })).toHaveAttribute('href', 'https://t.me/well_circle');
  });

  it('opens support through the Telegram bridge in the Mini App', async () => {
    const openTelegramLink = vi.fn();
    window.Telegram = { WebApp: { openTelegramLink } };
    render(<ErrorScreen variant="unexpected" />);
    await userEvent.click(screen.getByRole('link', { name: /contact support/i }));
    expect(openTelegramLink).toHaveBeenCalledWith('https://t.me/well_circle');
  });

  it('keeps support as a regular link in a browser', () => {
    render(<ErrorScreen variant="notFound" homeHref="/" />);
    expect(screen.getByRole('link', { name: /contact support/i })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: /go back home/i })).toHaveAttribute('href', '/');
  });

  it('prevents duplicate retries and stays recoverable after a rejected attempt', async () => {
    let reject;
    const onRetry = vi.fn(() => new Promise((_, fail) => { reject = fail; }));
    render(<ErrorScreen onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByRole('button', { name: /trying again/i })).toBeDisabled();
    reject(new Error('still offline'));
    expect(await screen.findByRole('button', { name: /try again/i })).toBeEnabled();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
