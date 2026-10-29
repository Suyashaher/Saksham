import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Send, AlertTriangle, Shield, CheckCircle2, Lock, ArrowLeft } from 'lucide-react';
import { apiClient, formatApiError } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { releaseRequestSchema, ReleaseRequestFormData } from '../../utils/validation';
import { formatINR, formatDateIST } from '../../utils/formatters';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export const ReleaseRequestWizard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failedConditions, setFailedConditions] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  // Load instrument info
  const { data: instrument, isLoading } = useQuery({
    queryKey: queryKeys.instruments.detail(id!),
    queryFn: async () => {
      const res = await apiClient.get(`/instruments/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ReleaseRequestFormData>({
    resolver: zodResolver(releaseRequestSchema),
    defaultValues: {
      request_type: 'RELEASE',
      reason: '',
    },
  });

  const requestType = watch('request_type');

  const onSubmit = async (data: ReleaseRequestFormData) => {
    setIsSubmitting(true);
    setServerError(null);
    setFailedConditions([]);

    try {
      const res = await apiClient.post(`/instruments/${id}/release-requests`, data);
      success(
        'Release Request Lodged',
        'Your release request has been submitted for verification officer scrutiny.'
      );
      navigate(`/release-requests/${res.data.id}`);
    } catch (err: any) {
      if (err.response?.status === 422 && err.response?.data?.failed_conditions) {
        setFailedConditions(err.response.data.failed_conditions);
        setServerError('Mandatory pre-conditions not met. See failed criteria below.');
      } else {
        const msg = formatApiError(err, 'Failed to lodge release request.');
        setServerError(msg);
      }
      toastError('Request Rejected', 'Could not lodge release request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading instrument details...</div>;
  }

  if (!instrument) {
    return <div className="p-8 text-center text-slate-500">Instrument not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Initiate Security Deposit Release / Refund"
        subtitle={`Instrument: ${instrument.fdr_number} • Principal: ${formatINR(instrument.amount)}`}
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Instruments', path: '/instruments' },
          { label: instrument.fdr_number, path: `/instruments/${id}` },
          { label: 'Request Release' },
        ]}
      />

      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-6">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Statutory Multi-Level Release Protocol</p>
            <p className="mt-0.5 leading-relaxed">
              Security deposit releases are evaluated against AICTE compliance criteria by a Verifying Officer
              and ratified by an Approving Authority. Ensure all mandatory institutional criteria are satisfied.
            </p>
          </div>
        </div>

        {serverError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>{serverError}</span>
            </div>
            {failedConditions.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 font-medium">
                {failedConditions.map((cond, idx) => (
                  <li key={idx}>{cond}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Request Type *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 border rounded-lg cursor-pointer flex items-center gap-2 transition-colors ${
                  requestType === 'RELEASE'
                    ? 'border-primary bg-primary/5 text-primary-dark font-semibold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  value="RELEASE"
                  {...register('request_type')}
                  className="sr-only"
                />
                <div>
                  <p className="text-sm">Standard Release</p>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Discharge lien and release deposit back to bank
                  </p>
                </div>
              </label>

              <label
                className={`p-3 border rounded-lg cursor-pointer flex items-center gap-2 transition-colors ${
                  requestType === 'REFUND'
                    ? 'border-primary bg-primary/5 text-primary-dark font-semibold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  value="REFUND"
                  {...register('request_type')}
                  className="sr-only"
                />
                <div>
                  <p className="text-sm">Direct Refund</p>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Refund funds to institutional bank account
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Justification for Release *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Approved cessation of Mechanical Engineering program as per AICTE Order No. 2026/CZ/124."
              {...register('reason')}
              className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.reason && (
              <p className="text-xs text-red-600 mt-1">{errors.reason.message}</p>
            )}
          </div>

          {/* Conditional Beneficiary Details for REFUND */}
          {requestType === 'REFUND' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Field-Level Encrypted Beneficiary Bank Information</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Beneficiary data is AES-256-GCM encrypted in transit and at rest, masked from regular views.
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Beneficiary Account Holder Name *
                  </label>
                  <input
                    type="text"
                    {...register('beneficiary_details.account_name')}
                    placeholder="e.g. Delhi Technological University"
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                  />
                  {errors.beneficiary_details?.account_name && (
                    <p className="text-red-600 mt-0.5">
                      {errors.beneficiary_details.account_name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Bank Account Number *
                  </label>
                  <input
                    type="text"
                    {...register('beneficiary_details.account_number')}
                    placeholder="1234567890"
                    className="w-full py-2 px-3 font-mono bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                  />
                  {errors.beneficiary_details?.account_number && (
                    <p className="text-red-600 mt-0.5">
                      {errors.beneficiary_details.account_number.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    IFSC Code *
                  </label>
                  <input
                    type="text"
                    {...register('beneficiary_details.ifsc_code')}
                    placeholder="SBIN0001234"
                    className="w-full py-2 px-3 font-mono uppercase bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                  />
                  {errors.beneficiary_details?.ifsc_code && (
                    <p className="text-red-600 mt-0.5">
                      {errors.beneficiary_details.ifsc_code.message}
                    </p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    {...register('beneficiary_details.bank_name')}
                    placeholder="State Bank of India"
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                  />
                  {errors.beneficiary_details?.bank_name && (
                    <p className="text-red-600 mt-0.5">
                      {errors.beneficiary_details.bank_name.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-200">
            <Button variant="outline" size="md" onClick={() => navigate(-1)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Submit Release Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
