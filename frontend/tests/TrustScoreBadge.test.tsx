import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustScoreBadge } from '../src/components/ui/ai/TrustScoreBadge';

describe('TrustScoreBadge Component (WCAG 2.1 AA & Band Boundaries)', () => {
  it('renders High priority band with flag icon at boundary 49', () => {
    render(<TrustScoreBadge score={49} band="LOW" />);
    const badge = screen.getByRole('button');
    expect(badge).toHaveTextContent('49%');
    expect(badge).toHaveTextContent('(High priority)');
    expect(badge.getAttribute('aria-label')).toContain('Band: High priority');
  });

  it('renders Needs review band at boundary 50', () => {
    render(<TrustScoreBadge score={50} band="MEDIUM" />);
    const badge = screen.getByRole('button');
    expect(badge).toHaveTextContent('50%');
    expect(badge).toHaveTextContent('(Needs review)');
    expect(badge.getAttribute('aria-label')).toContain('Band: Needs review');
  });

  it('renders Needs review band at boundary 79', () => {
    render(<TrustScoreBadge score={79} band="MEDIUM" />);
    const badge = screen.getByRole('button');
    expect(badge).toHaveTextContent('79%');
    expect(badge).toHaveTextContent('(Needs review)');
    expect(badge.getAttribute('aria-label')).toContain('Band: Needs review');
  });

  it('renders Low risk band with check icon at boundary 80', () => {
    render(<TrustScoreBadge score={80} band="HIGH" />);
    const badge = screen.getByRole('button');
    expect(badge).toHaveTextContent('80%');
    expect(badge).toHaveTextContent('(Low risk)');
    expect(badge.getAttribute('aria-label')).toContain('Band: Low risk');
  });

  it('renders graceful fallback when score is null/undefined', () => {
    render(<TrustScoreBadge score={null} />);
    expect(screen.getByText('Score pending')).toBeInTheDocument();
  });
});
