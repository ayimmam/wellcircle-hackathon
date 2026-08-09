import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ProviderDetail from '../pages/ProviderDetail';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_PROVIDERS } from '../data/mock';

describe('ProviderDetail — Getting there (Phase 8)', () => {
  it('renders navigation tips and facilities for a provider that has them', async () => {
    const boston = MOCK_PROVIDERS.find(p => p.name === 'Boston Day Spa');
    renderWithProviders(
      <Routes><Route path="/provider/:id" element={<ProviderDetail />} /></Routes>,
      { route: `/provider/${boston.id}` },
    );

    expect(await screen.findByText('Getting there')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText(boston.navigation_tips[0].detail)).toBeInTheDocument();
    expect(screen.getByText('Facilities')).toBeInTheDocument();
    expect(screen.getByText(boston.facilities[0])).toBeInTheDocument();
  });

  it('renders no section for a provider with no tips or facilities', async () => {
    const plain = MOCK_PROVIDERS.find(p => !p.navigation_tips?.length && !p.facilities?.length);
    renderWithProviders(
      <Routes><Route path="/provider/:id" element={<ProviderDetail />} /></Routes>,
      { route: `/provider/${plain.id}` },
    );

    await screen.findByText(plain.name);
    expect(screen.queryByText('Getting there')).not.toBeInTheDocument();
  });
});
