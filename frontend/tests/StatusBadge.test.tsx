import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge, InstrumentStatusType } from '../src/components/ui/StatusBadge';

describe('StatusBadge component', () => {
  const allStatuses: InstrumentStatusType[] = [
    'SUBMITTED',
    'UNDER_SCRUTINY',
    'VERIFIED',
    'DISCREPANCY',
    'ACTIVE',
    'EXPIRING',
    'MATURED',
    'RENEWED',
    'RELEASE_REQUESTED',
    'RELEASED',
  ];

  it('renders all 10 statuses with proper text labels and accessibility attributes', () => {
    allStatuses.forEach((status) => {
      const { unmount } = render(<StatusBadge status={status} />);
      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge.getAttribute('aria-label')).toContain('Status:');
      unmount();
    });
  });

  it('applies distinct color and styling tokens for ACTIVE vs DISCREPANCY', () => {
    const { unmount: unmountActive } = render(<StatusBadge status="ACTIVE" />);
    const activeBadge = screen.getByRole('status');
    expect(activeBadge.className).toContain('text-emerald-700');
    unmountActive();

    const { unmount: unmountDiscrepancy } = render(<StatusBadge status="DISCREPANCY" />);
    const discrepancyBadge = screen.getByRole('status');
    expect(discrepancyBadge.className).toContain('text-red-700');
    unmountDiscrepancy();
  });
});
