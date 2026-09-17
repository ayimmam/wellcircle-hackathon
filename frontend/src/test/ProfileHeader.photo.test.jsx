import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '../context/AuthContext';
import ProfileHeader from '../pages/profile/ProfileHeader';
import { renderWithProviders } from './renderWithProviders';

const { changeProfilePhotoMock } = vi.hoisted(() => ({ changeProfilePhotoMock: vi.fn() }));

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, changeProfilePhoto: changeProfilePhotoMock };
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Mounts ProfileHeader wired to the real AuthContext, mirroring how
// ProfileScreen.jsx uses it, so `useAuth().setUser` patches actually flow
// through to what the header reads back out as `user`.
function Harness() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <ProfileHeader
      user={user} tier={{ name: 'Seed', color: '#000' }} navigate={() => {}} t={(s) => s}
      bio="" setBio={() => {}} editingBio={false} setEditingBio={() => {}}
      savingBio={false} saveBio={() => {}}
    />
  );
}

function renderHeader() {
  return renderWithProviders(<Harness />, { route: '/profile' });
}

// WS9 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md.
describe('ProfileHeader — change photo (-10 points)', () => {
  beforeEach(() => {
    changeProfilePhotoMock.mockReset();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-photo');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('shows the cost notice before the file picker opens', async () => {
    renderHeader();
    await screen.findByText('Change your photo?', { exact: false }).catch(() => {});
    expect(document.getElementById('profile-photo-cost-notice')).not.toBeInTheDocument();

    fireEvent.click(document.getElementById('profile-photo-camera-btn'));
    expect(await screen.findByText(/costs 10 points/i)).toBeInTheDocument();

    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    fireEvent.click(document.getElementById('profile-photo-cost-notice-continue'));
    expect(clickSpy).toHaveBeenCalled();
    expect(document.getElementById('profile-photo-cost-notice')).not.toBeInTheDocument();
  });

  it('swaps the avatar to the local blob and drops the points badge before the request resolves, then reconciles on success', async () => {
    const d = deferred();
    changeProfilePhotoMock.mockReturnValue(d.promise);
    renderHeader();
    await screen.findByLabelText('Change profile photo');

    const avatarImgBefore = document.querySelector('.profile-avatar img');
    const initialSrc = avatarImgBefore?.getAttribute('src');

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.getElementById('profile-photo-input'), { target: { files: [file] } });

    // Optimistic swap lands before the mock request resolves.
    await waitFor(() => {
      const img = document.querySelector('.profile-avatar img');
      expect(img?.getAttribute('src')).toBe('blob:mock-photo');
      expect(img?.getAttribute('src')).not.toBe(initialSrc);
    });

    d.resolve({ photo_url: 'https://cdn.test/real-photo.jpg', points_balance: 999 });
    await waitFor(() => {
      const img = document.querySelector('.profile-avatar img');
      expect(img?.getAttribute('src')).toBe('https://cdn.test/real-photo.jpg');
    });
  });

  it('restores the previous photo and balance on failure', async () => {
    const d = deferred();
    changeProfilePhotoMock.mockReturnValue(d.promise);
    renderHeader();
    await screen.findByLabelText('Change profile photo');

    const initialSrc = document.querySelector('.profile-avatar img')?.getAttribute('src');

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.getElementById('profile-photo-input'), { target: { files: [file] } });

    await waitFor(() => {
      expect(document.querySelector('.profile-avatar img')?.getAttribute('src')).toBe('blob:mock-photo');
    });

    d.reject(new Error('Upload failed'));
    await waitFor(() => {
      expect(document.querySelector('.profile-avatar img')?.getAttribute('src')).toBe(initialSrc);
    });
  });
});
