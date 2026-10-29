import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VerificationTag } from '../src/components/ui/VerificationTag';

describe('VerificationTag component', () => {
  it('renders Bank-Verified state with filled style and shield icon', () => {
    render(<VerificationTag isBankVerified={true} verifiedAt="27 Oct 2026" />);
    const tag = screen.getByText('Bank-Verified');
    expect(tag).toBeInTheDocument();
  });

  it('renders Self-Declared state with outlined style', () => {
    render(<VerificationTag isBankVerified={false} />);
    const tag = screen.getByText('Self-Declared');
    expect(tag).toBeInTheDocument();
  });

  it('displays explanatory tooltip on hover or keyboard focus', () => {
    render(<VerificationTag isBankVerified={true} sourceText="State Bank API" />);
    const trigger = screen.getByRole('note');
    fireEvent.mouseEnter(trigger);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent).toContain('Bank-Verified: Confirmed with issuing branch records');
  });
});
