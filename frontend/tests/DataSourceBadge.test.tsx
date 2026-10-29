import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataSourceBadge } from '../src/components/ui/ai/DataSourceBadge';

describe('DataSourceBadge Component (Data Provenance & Honesty)', () => {
  it('renders Synthetic data badge with violet styling and explanatory note', () => {
    render(<DataSourceBadge source="synthetic" />);
    const badge = screen.getByRole('note');
    expect(badge).toHaveTextContent('Synthetic data');
    expect(badge.getAttribute('aria-label')).toContain('Trained on simulated data');
  });

  it('renders Real data badge for verified production metrics', () => {
    render(<DataSourceBadge source="real" />);
    const badge = screen.getByRole('note');
    expect(badge).toHaveTextContent('Real data');
    expect(badge.getAttribute('aria-label')).toContain('verified production');
  });

  it('renders Rule-based badge for deterministic models', () => {
    render(<DataSourceBadge source="rule_based" />);
    const badge = screen.getByRole('note');
    expect(badge).toHaveTextContent('Rule-based');
    expect(badge.getAttribute('aria-label')).toContain('deterministic policy rules');
  });

  it('returns null when source is n/a', () => {
    const { container } = render(<DataSourceBadge source="n/a" />);
    expect(container.firstChild).toBeNull();
  });
});
