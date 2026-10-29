import { describe, it, expect } from 'vitest';
import {
  instrumentFormSchema,
  releaseRequestSchema,
  alertRuleSchema,
} from '../src/utils/validation';

describe('Validation Schemas', () => {
  describe('instrumentFormSchema', () => {
    it('validates a complete compliant FDR form', () => {
      const validData = {
        fdr_number: 'FDR-2026-001',
        instrument_type: 'FDR' as const,
        bank_name: 'State Bank of India',
        branch_name: 'Connaught Place',
        ifsc_code: 'SBIN0001234',
        amount: '1500000',
        currency: 'INR',
        issue_date: '2026-01-01',
        maturity_date: '2029-01-01',
        auto_renewal: false,
        joint_holder_name: 'All India Council for Technical Education',
      };

      const result = instrumentFormSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects invalid IFSC codes', () => {
      const invalidData = {
        fdr_number: 'FDR-2026-001',
        bank_name: 'State Bank of India',
        branch_name: 'Connaught Place',
        ifsc_code: 'INVALID_IFSC',
        amount: '1500000',
        issue_date: '2026-01-01',
        maturity_date: '2029-01-01',
        joint_holder_name: 'AICTE',
      };

      const result = instrumentFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects maturity date earlier than issue date', () => {
      const invalidData = {
        fdr_number: 'FDR-2026-001',
        bank_name: 'State Bank of India',
        branch_name: 'Connaught Place',
        ifsc_code: 'SBIN0001234',
        amount: '1500000',
        issue_date: '2026-10-01',
        maturity_date: '2026-05-01',
        joint_holder_name: 'AICTE',
      };

      const result = instrumentFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects zero or negative amount', () => {
      const invalidData = {
        fdr_number: 'FDR-2026-001',
        bank_name: 'State Bank of India',
        branch_name: 'Connaught Place',
        ifsc_code: 'SBIN0001234',
        amount: '0',
        issue_date: '2026-01-01',
        maturity_date: '2029-01-01',
        joint_holder_name: 'AICTE',
      };

      const result = instrumentFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('alertRuleSchema', () => {
    it('accepts valid alert rule configuration', () => {
      const validRule = {
        name: 'Early Maturity Reminder',
        rule_type: 'MATURITY_REMINDER' as const,
        days: 90,
        recipient_role: 'INSTITUTION' as const,
        channels: ['EMAIL', 'IN_APP'] as ('EMAIL' | 'IN_APP')[],
        is_active: true,
      };

      const result = alertRuleSchema.safeParse(validRule);
      expect(result.success).toBe(true);
    });
  });
});
