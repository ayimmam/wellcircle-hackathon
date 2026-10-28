import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import LegalPage from '../pages/LegalPage';
import { legalDocuments } from '../data/legal';
execFileSync(process.execPath, [resolve(process.cwd(), 'scripts/generate-legal-pages.mjs')]);

describe('public legal documents', () => {
  it.each(Object.entries(legalDocuments))('renders %s without an authenticated context', (key, policy) => {
    render(<MemoryRouter><LegalPage document={key} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: policy.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hello@wellcircle.et' })).toHaveAttribute('href', 'mailto:hello@wellcircle.et');
  });
  it.each(Object.values(legalDocuments))('ships crawler-readable HTML: $file', policy => {
    const html = readFileSync(resolve(process.cwd(), 'public', policy.file), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('h1').textContent).toBe(policy.title);
    expect(doc.querySelector('a[href="/terms.html"]')).toBeTruthy();
    expect(doc.querySelector('a[href="mailto:hello@wellcircle.et"]')).toBeTruthy();
    expect(doc.querySelectorAll('script')).toHaveLength(0);
  });
});
