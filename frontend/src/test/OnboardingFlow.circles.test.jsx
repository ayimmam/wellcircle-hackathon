import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingFlow from '../pages/OnboardingFlow';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_CIRCLES } from '../data/mock';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

function goToInterestStep() {
  fireEvent.change(document.getElementById('onboarding-name-input'), { target: { value: 'Meron' } });
  fireEvent.click(document.getElementById('onboarding-next-btn')); // name -> goal
  fireEvent.click(document.getElementById('onboarding-next-btn')); // goal -> interest
}

async function goToCirclesStep() {
  goToInterestStep();
  fireEvent.click(document.getElementById('interest-yoga'));
  fireEvent.click(document.getElementById('interest-gym'));
  fireEvent.click(document.getElementById('onboarding-next-btn')); // interest -> frequency
  fireEvent.click(document.getElementById('onboarding-next-btn')); // frequency -> circles
  await screen.findByText('Join a circle');
}

describe('OnboardingFlow — multi-select passions', () => {
  it('allows selecting more than one interest', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    goToInterestStep();

    fireEvent.click(document.getElementById('interest-yoga'));
    fireEvent.click(document.getElementById('interest-gym'));

    expect(document.getElementById('interest-yoga').className).toContain('selected');
    expect(document.getElementById('interest-gym').className).toContain('selected');
  });

  it('Next stays disabled until at least one interest is picked, and clicking again deselects', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    goToInterestStep();

    expect(document.getElementById('onboarding-next-btn')).toBeDisabled();
    fireEvent.click(document.getElementById('interest-yoga'));
    expect(document.getElementById('onboarding-next-btn')).not.toBeDisabled();

    fireEvent.click(document.getElementById('interest-yoga')); // deselect
    expect(document.getElementById('interest-yoga').className).not.toContain('selected');
    expect(document.getElementById('onboarding-next-btn')).toBeDisabled();
  });
});

describe('OnboardingFlow — circles step', () => {
  it('shows a one-sentence explainer of what circles are', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    await goToCirclesStep();

    expect(screen.getByText(/accountability groups/i)).toBeInTheDocument();
  });

  it('lists available (joinable) real circles and joining shows an invite card', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    await goToCirclesStep();

    const firstCircle = MOCK_CIRCLES[0];
    await waitFor(() => expect(document.getElementById(`circle-${firstCircle.id}`)).toBeInTheDocument());

    expect(document.getElementById('onboarding-circle-invite-card')).toBeNull();
    fireEvent.click(document.getElementById(`circle-${firstCircle.id}`));

    await waitFor(() => expect(document.getElementById('onboarding-circle-invite-card')).toBeInTheDocument());
    expect(document.getElementById('onboarding-circle-invite-card').textContent).toContain(firstCircle.name);
  });

  it('can create a brand-new circle, which then shows the invite card', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    await goToCirclesStep();

    expect(document.getElementById('create-circle-btn')).toBeDisabled();
    fireEvent.change(document.getElementById('new-circle-name-input'), { target: { value: 'Morning Yogis' } });
    expect(document.getElementById('create-circle-btn')).not.toBeDisabled();
    fireEvent.click(document.getElementById('create-circle-btn'));

    await waitFor(() => expect(document.getElementById('onboarding-circle-invite-card')).toBeInTheDocument());
    expect(document.getElementById('onboarding-circle-invite-card').textContent).toContain('Morning Yogis');
    // input clears after a successful create
    expect(document.getElementById('new-circle-name-input').value).toBe('');
  });

  it('shows at most 2 circle suggestions total, merged into one unlabelled list', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    await goToCirclesStep();

    await waitFor(() => {
      const cards = document.querySelectorAll('[id^="circle-"]');
      expect(cards.length).toBeGreaterThan(0);
      expect(cards.length).toBeLessThanOrEqual(2);
    });

    // No section headers — a single merged list
    expect(screen.queryByText('Recommended for you')).not.toBeInTheDocument();
    expect(screen.queryByText('Available Circles')).not.toBeInTheDocument();
  });

  it('the create-your-own input is still present alongside the capped suggestions', async () => {
    renderWithProviders(<OnboardingFlow />, { route: '/onboarding' });
    await screen.findByText("What's your name?");
    await goToCirclesStep();

    expect(document.getElementById('new-circle-name-input')).toBeInTheDocument();
    expect(document.getElementById('create-circle-btn')).toBeInTheDocument();
  });
});
