import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import CommunityList from '../pages/CommunityList';
import { renderWithProviders } from './renderWithProviders';

// Real seed circles (src/data/mock.js): "Addis Morning Runners", "Zen
// Seekers", "Hana Endurance Club".
describe('CommunityList — circle search', () => {
  it('filters the circle list by name as the user types, and clears back to the full list', async () => {
    renderWithProviders(<CommunityList />);
    fireEvent.click(screen.getByRole('button', { name: 'My Circles' }));

    await screen.findByText('Addis Morning Runners');
    expect(screen.getByText('Zen Seekers')).toBeInTheDocument();
    expect(screen.getByText('Hana Endurance Club')).toBeInTheDocument();

    fireEvent.change(document.getElementById('circle-search-input'), { target: { value: 'zen' } });

    await waitFor(() => {
      expect(screen.getByText('Zen Seekers')).toBeInTheDocument();
      expect(screen.queryByText('Addis Morning Runners')).not.toBeInTheDocument();
      expect(screen.queryByText('Hana Endurance Club')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
    await waitFor(() => expect(screen.getByText('Addis Morning Runners')).toBeInTheDocument());
  });

  it('shows a no-results empty state for a query that matches nothing', async () => {
    renderWithProviders(<CommunityList />);
    fireEvent.click(screen.getByRole('button', { name: 'My Circles' }));

    await screen.findByText('Addis Morning Runners');
    fireEvent.change(document.getElementById('circle-search-input'), { target: { value: 'nonexistent circle' } });

    expect(await screen.findByText(/No circles match/i)).toBeInTheDocument();
  });
});
