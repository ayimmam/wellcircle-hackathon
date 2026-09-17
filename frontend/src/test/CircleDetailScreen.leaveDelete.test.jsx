import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import CircleDetailScreen from '../pages/CircleDetailScreen';
import { MOCK_CIRCLES } from '../data/mock';
import { renderWithProviders } from './renderWithProviders';

// WS8 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md.
describe('CircleDetailScreen — leave/delete', () => {
  const memberCircle = MOCK_CIRCLES.find(c => !c.is_joined && !c.is_private && !c.is_paid);
  const ownedCircle = MOCK_CIRCLES.find(c => c.is_joined && c.is_owner !== false);

  afterEach(() => {
    memberCircle.is_joined = false;
  });

  function renderCircle(circle) {
    return renderWithProviders(
      <Routes>
        <Route path="/circle/:id" element={<CircleDetailScreen />} />
        <Route path="/community" element={<div>Community Screen</div>} />
      </Routes>,
      { route: `/circle/${circle.id}` },
    );
  }

  it('a member sees Leave only, no Delete option', async () => {
    memberCircle.is_joined = true;
    renderCircle(memberCircle);
    await screen.findByText(memberCircle.name);

    fireEvent.click(document.getElementById('circle-detail-menu-btn'));
    expect(document.getElementById('circle-detail-leave-btn')).toBeInTheDocument();
    expect(document.getElementById('circle-detail-delete-btn')).not.toBeInTheDocument();
  });

  it('an owner sees Leave and Delete', async () => {
    renderCircle(ownedCircle);
    await screen.findByText(ownedCircle.name);

    fireEvent.click(document.getElementById('circle-detail-menu-btn'));
    expect(document.getElementById('circle-detail-leave-btn')).toBeInTheDocument();
    expect(document.getElementById('circle-detail-delete-btn')).toBeInTheDocument();
  });

  it('the delete confirm stays disabled until the typed name matches', async () => {
    renderCircle(ownedCircle);
    await screen.findByText(ownedCircle.name);

    fireEvent.click(document.getElementById('circle-detail-menu-btn'));
    fireEvent.click(document.getElementById('circle-detail-delete-btn'));

    const confirmBtn = document.getElementById('circle-delete-confirm-btn');
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(document.getElementById('circle-delete-confirm-input'), {
      target: { value: 'wrong name' },
    });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(document.getElementById('circle-delete-confirm-input'), {
      target: { value: ownedCircle.name },
    });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('leaving navigates away and removes the circle from My Circles before the request resolves', async () => {
    memberCircle.is_joined = true;
    renderCircle(memberCircle);
    await screen.findByText(memberCircle.name);

    fireEvent.click(document.getElementById('circle-detail-menu-btn'));
    fireEvent.click(document.getElementById('circle-detail-leave-btn'));
    fireEvent.click(document.getElementById('circle-leave-confirm-btn'));

    // Navigated away immediately — before the mock request has resolved.
    expect(await screen.findByText('Community Screen')).toBeInTheDocument();

    await waitFor(() => {
      expect(MOCK_CIRCLES.find(c => c.id === memberCircle.id)).toBeUndefined();
    });
  });
});
