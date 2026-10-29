import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InstrumentTypeBadge } from '../src/components/ui/InstrumentTypeBadge';
import { instrumentFormSchema } from '../src/utils/validation';

describe('InstrumentTypeBadge Component', () => {
  it('renders Fixed Deposit Receipt badge by default', () => {
    render(<InstrumentTypeBadge type="FDR" />);
    expect(screen.getByText('Fixed Deposit')).toBeInTheDocument();
    expect(screen.getByTitle('Fixed Deposit Receipt Instrument')).toBeInTheDocument();
  });

  it('renders Bank Guarantee badge when type is BANK_GUARANTEE', () => {
    render(<InstrumentTypeBadge type="BANK_GUARANTEE" />);
    expect(screen.getByText('Bank Guarantee')).toBeInTheDocument();
    expect(screen.getByTitle('Bank Guarantee Instrument')).toBeInTheDocument();
  });
});

describe('InstrumentForm Validation for Bank Guarantee', () => {
  const baseValidFdr = {
    fdr_number: 'FDR-SBI-2026-001',
    instrument_type: 'FDR' as const,
    bank_name: 'State Bank of India',
    branch_name: 'Main Branch',
    ifsc_code: 'SBIN0001234',
    amount: '1000000',
    currency: 'INR',
    issue_date: '2026-01-01',
    maturity_date: '2027-01-01',
    joint_holder_name: 'AICTE',
    auto_renewal: false,
    beneficiary_name: 'AICTE',
  };

  it('validates a correct FDR form', () => {
    const result = instrumentFormSchema.safeParse(baseValidFdr);
    expect(result.success).toBe(true);
  });

  it('requires claim_expiry_date for BANK_GUARANTEE', () => {
    const bgWithoutClaim = {
      ...baseValidFdr,
      instrument_type: 'BANK_GUARANTEE' as const,
      fdr_number: 'BG-HDFC-2026-001',
    };
    const result = instrumentFormSchema.safeParse(bgWithoutClaim);
    expect(result.success).toBe(false);
  });

  it('rejects claim_expiry_date before maturity_date for BANK_GUARANTEE', () => {
    const bgBadClaim = {
      ...baseValidFdr,
      instrument_type: 'BANK_GUARANTEE' as const,
      fdr_number: 'BG-HDFC-2026-001',
      maturity_date: '2027-01-01',
      claim_expiry_date: '2026-12-15',
    };
    const result = instrumentFormSchema.safeParse(bgBadClaim);
    expect(result.success).toBe(false);
  });

  it('accepts valid BANK_GUARANTEE with claim_expiry_date >= maturity_date', () => {
    const bgValid = {
      ...baseValidFdr,
      instrument_type: 'BANK_GUARANTEE' as const,
      fdr_number: 'BG-HDFC-2026-001',
      maturity_date: '2027-01-01',
      claim_expiry_date: '2027-03-01',
    };
    const result = instrumentFormSchema.safeParse(bgValid);
    expect(result.success).toBe(true);
  });
});
