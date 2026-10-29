import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid official email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d+$/, 'OTP must contain numbers only'),
});

export type OtpFormData = z.infer<typeof otpSchema>;

export const instrumentFormSchema = z
  .object({
    fdr_number: z.string().min(3, 'Reference / Guarantee number must be at least 3 characters').max(50),
    instrument_type: z.enum(['FDR', 'BANK_GUARANTEE']).default('FDR'),
    bank_name: z.string().min(2, 'Bank name is required').max(100),
    branch_name: z.string().min(2, 'Branch name is required').max(100),
    ifsc_code: z
      .string()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC format (e.g., SBIN0001234)'),
    amount: z
      .string()
      .min(1, 'Amount is required')
      .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: 'Amount must be greater than zero',
      }),
    currency: z.string().default('INR'),
    issue_date: z.string().min(1, 'Issue date is required'),
    maturity_date: z.string().min(1, 'Maturity date is required'),
    claim_expiry_date: z.string().optional(),
    beneficiary_name: z.string().default('AICTE'),
    auto_renewal: z.boolean().default(false),
    joint_holder_name: z
      .string()
      .min(1, 'Joint holder is required (e.g. AICTE / Member Secretary AICTE)'),
    remarks: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.issue_date || !data.maturity_date) return true;
      return new Date(data.maturity_date) > new Date(data.issue_date);
    },
    {
      message: 'Maturity date must be after issue date',
      path: ['maturity_date'],
    }
  )
  .refine(
    (data) => {
      if (data.instrument_type === 'BANK_GUARANTEE') {
        if (!data.claim_expiry_date) return false;
        if (!data.maturity_date) return true;
        return new Date(data.claim_expiry_date) >= new Date(data.maturity_date);
      }
      return true;
    },
    {
      message: 'Claim expiry date must be on or after guarantee maturity date',
      path: ['claim_expiry_date'],
    }
  );

export type InstrumentFormData = z.infer<typeof instrumentFormSchema>;

export const renewalFormSchema = z
  .object({
    fdr_number: z.string().min(3, 'New FDR number is required'),
    bank_name: z.string().min(2, 'Bank name is required'),
    branch_name: z.string().min(2, 'Branch name is required'),
    ifsc_code: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC format'),
    amount: z
      .string()
      .min(1, 'Amount is required')
      .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: 'Amount must be greater than zero',
      }),
    issue_date: z.string().min(1, 'Issue date is required'),
    maturity_date: z.string().min(1, 'Maturity date is required'),
    renewal_reason: z.string().min(5, 'Please provide a valid renewal reason'),
  })
  .refine(
    (data) => {
      if (!data.issue_date || !data.maturity_date) return true;
      return new Date(data.maturity_date) > new Date(data.issue_date);
    },
    {
      message: 'Maturity date must be after issue date',
      path: ['maturity_date'],
    }
  );

export type RenewalFormData = z.infer<typeof renewalFormSchema>;

export const releaseRequestSchema = z.object({
  request_type: z.enum(['RELEASE', 'REFUND']),
  reason: z.string().min(10, 'Reason must be at least 10 characters detailing the request'),
  beneficiary_details: z
    .object({
      account_number: z.string().min(6, 'Account number is required'),
      account_name: z.string().min(2, 'Account holder name is required'),
      bank_name: z.string().min(2, 'Bank name is required'),
      ifsc_code: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC format'),
      branch: z.string().optional(),
    })
    .optional(),
});

export type ReleaseRequestFormData = z.infer<typeof releaseRequestSchema>;

export const alertRuleSchema = z.object({
  name: z.string().min(3, 'Rule name is required'),
  rule_type: z.enum([
    'MATURITY_REMINDER',
    'OVERDUE_MATURED',
    'STALE_VERIFICATION',
    'DISCREPANCY_UNRESOLVED',
    'RELEASE_PENDING',
  ]),
  days: z.coerce.number().int().min(1, 'Days must be at least 1'),
  recipient_role: z.enum(['INSTITUTION', 'VERIFYING_OFFICER', 'APPROVING_AUTHORITY']),
  channels: z.array(z.enum(['EMAIL', 'SMS', 'IN_APP'])).min(1, 'Select at least one channel'),
  escalate_after_days: z.coerce.number().int().min(1).optional().nullable(),
  is_active: z.boolean().default(true),
});

export type AlertRuleFormData = z.infer<typeof alertRuleSchema>;
