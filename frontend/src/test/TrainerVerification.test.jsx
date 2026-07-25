import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import TrainerVerification from '../pages/TrainerVerification';
import { renderWithProviders } from './renderWithProviders';

describe('TrainerVerification', () => {
  it('explains annual pricing and advances to certificate upload', async () => {
    renderWithProviders(
      <Routes><Route path="/trainer/verify" element={<TrainerVerification />} /></Routes>,
      { route: '/trainer/verify' },
    );
    expect(await screen.findByText(/ETB 200 per year/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start application' }));
    expect(screen.getByRole('heading', { name: 'Upload your certificate' })).toBeInTheDocument();
    expect(screen.getByText(/PDF, JPG or PNG/)).toBeInTheDocument();
  });

  it('uploads both documents and submits a pending application', async () => {
    const { container } = renderWithProviders(
      <Routes><Route path="/trainer/verify" element={<TrainerVerification />} /></Routes>,
      { route: '/trainer/verify' },
    );
    await screen.findByText(/ETB 200 per year/);
    fireEvent.click(screen.getByRole('button', { name: 'Start application' }));

    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['certificate'], 'certificate.pdf', { type: 'application/pdf' })] },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['receipt'], 'receipt.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('certificate.pdf')).toBeInTheDocument();
    expect(screen.getByText('receipt.png')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
    expect(await screen.findByRole('heading', { name: 'Application under review' })).toBeInTheDocument();
  });
});
