import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import OnboardingFlow from '../pages/OnboardingFlow';
import { renderWithProviders } from './renderWithProviders';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

function goToStep(target) {
  // name → goal → interest → frequency → circles
  const next = () => fireEvent.click(document.getElementById('onboarding-next-btn'));
  fireEvent.change(document.getElementById('onboarding-name-input'), { target: { value: 'Meron' } });
  if (target === 'name') return;
  next(); // → goal
  if (target === 'goal') return;
  next(); // → interest (goal skippable)
  if (target === 'interest') return;
  fireEvent.click(document.getElementById('interest-yoga'));
  next(); // → frequency
}

describe('OnboardingFlow (Stage 1 psychology)', () => {
  it('endowed progress: first dot done + "1 of 5 already done" on the name step', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    const dots = document.querySelectorAll('.progress-dot');
    expect(dots[0].className).toContain('done');
    expect(screen.getByText(/1 of 5 already done/)).toBeInTheDocument();
  });

  it('smart default: frequency arrives pre-selected with a "Most popular" chip', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    goToStep('frequency');

    expect(screen.getByText('How often do you exercise?')).toBeInTheDocument();
    const defaultCard = document.getElementById('frequency-sometimes');
    expect(defaultCard.className).toContain('selected');
    expect(document.getElementById('most-popular-chip')).toBeInTheDocument();
    // Next is never dead on this step
    expect(document.getElementById('onboarding-next-btn')).not.toBeDisabled();
  });

  it('the default can still be changed', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    goToStep('frequency');

    fireEvent.click(document.getElementById('frequency-daily'));
    expect(document.getElementById('frequency-daily').className).toContain('selected');
    expect(document.getElementById('frequency-sometimes').className).not.toContain('selected');
  });
});
