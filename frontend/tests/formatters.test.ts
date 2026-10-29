import { describe, it, expect } from 'vitest';
import { formatINR, formatDateIST, getDaysRemaining, formatStatusLabel } from '../src/utils/formatters';

describe('formatINR utility', () => {
  it('formats zero and empty values correctly', () => {
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR('')).toBe('₹0');
    expect(formatINR(null)).toBe('₹0');
    expect(formatINR(undefined)).toBe('₹0');
  });

  it('formats thousands, lakhs, and crores without precision loss', () => {
    expect(formatINR(1000)).toBe('₹1,000');
    expect(formatINR('50000')).toBe('₹50,000');
    expect(formatINR('100000')).toBe('₹1,00,000'); // 1 Lakh
    expect(formatINR('1250000')).toBe('₹12,50,000'); // 12.5 Lakhs
    expect(formatINR('10000000')).toBe('₹1,00,00,000'); // 1 Crore
    expect(formatINR('254000000')).toBe('₹25,40,00,000'); // 25.4 Crores
  });

  it('preserves string Decimal cents when requested', () => {
    expect(formatINR('1250000.50', true)).toBe('₹12,50,000.50');
    expect(formatINR('1250000', true)).toBe('₹12,50,000.00');
  });

  it('handles negative values cleanly', () => {
    expect(formatINR('-50000')).toBe('₹-50,000');
  });
});

describe('formatDateIST utility', () => {
  it('formats ISO timestamps to Asia/Kolkata DD MMM YYYY', () => {
    const formatted = formatDateIST('2026-10-27T00:00:00Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Oct');
  });

  it('handles null, empty, or invalid dates gracefully', () => {
    expect(formatDateIST(null)).toBe('—');
    expect(formatDateIST('')).toBe('—');
    expect(formatDateIST(undefined)).toBe('—');
  });
});

describe('getDaysRemaining utility', () => {
  it('returns valid calendar day differences', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5);
    const days = getDaysRemaining(tomorrow.toISOString());
    expect(days).toBe(5);
  });

  it('returns negative value for past dates', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 3);
    const days = getDaysRemaining(yesterday.toISOString());
    expect(days).toBe(-3);
  });
});

describe('formatStatusLabel utility', () => {
  it('converts enum keys to capitalized title strings', () => {
    expect(formatStatusLabel('SUBMITTED')).toBe('Submitted');
    expect(formatStatusLabel('UNDER_SCRUTINY')).toBe('Under Scrutiny');
    expect(formatStatusLabel('RELEASE_REQUESTED')).toBe('Release Requested');
  });
});
