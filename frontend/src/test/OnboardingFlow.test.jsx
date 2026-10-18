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
  // name → interest → circles
  const next = () => fireEvent.click(document.getElementById('onboarding-next-btn'));
  fireEvent.change(document.getElementById('onboarding-name-input'), { target: { value: 'Meron' } });
  if (target === 'name') return;
  next(); // → interest
  if (target === 'interest') return;
  fireEvent.click(document.getElementById('interest-yoga'));
  next(); // → circles
}

describe('OnboardingFlow (Stage 1 psychology)', () => {
  it('shows the shortened three-step progress on the name step', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    const dots = document.querySelectorAll('.progress-dot');
    expect(dots[0].className).toContain('done');
    expect(screen.getByText(/1 of 3 already done/)).toBeInTheDocument();
  });

  it('moves optional goal, avatar, and frequency setup out of first run', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    goToStep('interest');
    expect(screen.queryByText("What's your wellness goal?")).not.toBeInTheDocument();
    expect(screen.queryByText('Pick your vibe')).not.toBeInTheDocument();
    expect(screen.queryByText('How often do you exercise?')).not.toBeInTheDocument();
  });

  it('selecting a passion on the interest step surfaces the circles hint immediately', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    goToStep('interest');

    expect(document.getElementById('interest-circles-hint')).toBeNull();
    fireEvent.click(document.getElementById('interest-yoga'));
    const hint = document.getElementById('interest-circles-hint');
    expect(hint).toBeInTheDocument();
    expect(hint.textContent).toContain('circles');
  });
});
