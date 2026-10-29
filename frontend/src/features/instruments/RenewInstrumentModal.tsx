import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import { apiClient, formatApiError } from '../../api/client';
import { renewalFormSchema, RenewalFormData } from '../../utils/validation';
import { formatINR, formatDateIST } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { AutoFillButton } from '../ai/ocr/AutoFillButton';

interface RenewInstrumentModalProps {
  originalInstrument: any;
  isOpen: boolean;
  onClose: () => void;
}

export const RenewInstrumentModal: React.FC<RenewInstrumentModalProps> = ({
  originalInstrument,
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RenewalFormData>({
    resolver: zodResolver(renewalFormSchema),
    defaultValues: {
      fdr_number: `${originalInstrument?.fdr_number || ''}-RNW`,
      bank_name: originalInstrument?.bank_name || '',
      branch_name: originalInstrument?.branch_name || '',
      ifsc_code: originalInstrument?.ifsc_code || '',
      amount: String(originalInstrument?.amount || ''),
      issue_date: new Date().toISOString().split('T')[0],
      renewal_reason: 'Statutory extension of security deposit for approved course duration.',
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: RenewalFormData) => {
    setIsSubmitting(true);
    setServerError(null);

    try {
      const res = await apiClient.post(`/instruments/${originalInstrument.id}/renew`, data);
      const newId = (res.data?.instrument || res.data)?.id;
      success(
        'FDR Renewed',
        `Successor instrument created with number ${data.fdr_number}. Previous instrument marked RENEWED.`
      );
      onClose();
      navigate(`/instruments/${newId}`);
    } catch (err: any) {
      const msg = formatApiError(err, 'Failed to submit renewal request.');
      setServerError(msg);
      toastError('Renewal Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-purple-100 text-purple-700">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Renew Fixed Deposit Receipt</h3>
            <p className="text-xs text-slate-500">
              Replacing predecessor: {originalInstrument.fdr_number} ({formatINR(originalInstrument.amount)})
            </p>
          </div>
        </div>

        {serverError && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="flex items-center justify-between p-3 bg-violet-50/60 rounded-lg border border-violet-200">
            <span className="text-xs font-semibold text-violet-900">Have renewed deposit certificate?</span>
            <AutoFillButton
              onApplyFields={(fields) => {
                if (fields.fdr_number) setValue('fdr_number', fields.fdr_number);
                if (fields.bank_name) setValue('bank_name', fields.bank_name);
                if (fields.branch) setValue('branch_name', fields.branch);
                if (fields.amount) setValue('amount', fields.amount);
                if (fields.issue_date) setValue('issue_date', fields.issue_date);
              }}
              currentFormValues={watch()}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Renewal FDR Number *
              </label>
              <input
                type="text"
                {...register('fdr_number')}
                className="w-full py-2 px-3 text-sm font-mono bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {errors.fdr_number && (
                <p className="text-xs text-red-600 mt-1">{errors.fdr_number.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Renewal Issue Date *
              </label>
              <input
                type="date"
                {...register('issue_date')}
                className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {errors.issue_date && (
                <p className="text-xs text-red-600 mt-1">{errors.issue_date.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Maturity Date *
              </label>
              <input
                type="date"
                {...register('maturity_date')}
                className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {errors.maturity_date && (
                <p className="text-xs text-red-600 mt-1">{errors.maturity_date.message}</p>
              )}
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Renewal Reason / AICTE Approval Reference *
              </label>
              <textarea
                rows={2}
                {...register('renewal_reason')}
                className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {errors.renewal_reason && (
                <p className="text-xs text-red-600 mt-1">{errors.renewal_reason.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Submit Renewal
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
