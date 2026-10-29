import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Building2,
  Calendar,
  CreditCard,
  FileCheck2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Check,
  Shield,
  FileText,
} from 'lucide-react';
import { apiClient, formatApiError } from '../../api/client';
import { useDocumentRegistry } from '../../api/meta';
import { instrumentFormSchema, InstrumentFormData } from '../../utils/validation';
import { formatINR, formatDateIST } from '../../utils/formatters';
import { PageHeader } from '../../components/ui/PageHeader';
import { FileUpload } from '../../components/ui/FileUpload';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { AutoFillButton } from '../ai/ocr/AutoFillButton';

export const NewInstrumentWizard: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError, warning: toastWarning } = useToast();
  const { data: registry } = useDocumentRegistry();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<InstrumentFormData>({
    resolver: zodResolver(instrumentFormSchema),
    defaultValues: {
      instrument_type: 'FDR',
      currency: 'INR',
      joint_holder_name: 'All India Council for Technical Education',
      beneficiary_name: 'AICTE',
      auto_renewal: false,
    },
    mode: 'onChange',
  });

  const formValues = watch();
  const isBG = formValues.instrument_type === 'BANK_GUARANTEE';

  const handleApplyOcrFields = (fields: Record<string, string>) => {
    if (fields.reference_number) setValue('fdr_number', fields.reference_number, { shouldValidate: true });
    if (fields.fdr_number) setValue('fdr_number', fields.fdr_number, { shouldValidate: true });
    if (fields.bank_name) setValue('bank_name', fields.bank_name, { shouldValidate: true });
    if (fields.branch) setValue('branch_name', fields.branch, { shouldValidate: true });
    if (fields.amount) setValue('amount', fields.amount, { shouldValidate: true });
    if (fields.issue_date) setValue('issue_date', fields.issue_date, { shouldValidate: true });
    if (fields.maturity_date) setValue('maturity_date', fields.maturity_date, { shouldValidate: true });
    if (fields.claim_expiry_date) setValue('claim_expiry_date', fields.claim_expiry_date, { shouldValidate: true });
    if (fields.beneficiary_name) setValue('beneficiary_name', fields.beneficiary_name, { shouldValidate: true });
  };

  const handleNextStep = async () => {
    let fieldsToValidate: (keyof InstrumentFormData)[] = [];
    if (currentStep === 1) {
      fieldsToValidate = ['instrument_type', 'fdr_number', 'bank_name', 'branch_name', 'ifsc_code'];
    } else if (currentStep === 2) {
      fieldsToValidate = ['amount', 'issue_date', 'maturity_date', 'joint_holder_name'];
      if (isBG) {
        fieldsToValidate.push('claim_expiry_date');
      }
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleFinalSubmit = async (data: InstrumentFormData) => {
    if (!selectedFile) {
      setServerError(`Please upload the ${isBG ? 'Bank Guarantee document' : 'FDR certificate'} before final submission.`);
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      // 1. Create Instrument
      const payload = {
        reference_number: data.fdr_number,
        instrument_type: data.instrument_type,
        issuing_bank: data.bank_name,
        branch: data.branch_name,
        amount: Number(data.amount),
        required_amount: Number(data.amount),
        issue_date: data.issue_date,
        maturity_date: data.maturity_date,
        claim_expiry_date: data.claim_expiry_date || null,
        beneficiary_name: data.beneficiary_name || 'AICTE',
      };

      const res = await apiClient.post('/instruments/', payload);
      const createdInstrument = res.data?.instrument || res.data;
      const instrumentId = createdInstrument?.id;

      if (!instrumentId) {
        throw new Error('Server returned an invalid instrument response.');
      }

      // 2. Upload Document
      try {
        const primaryDocType = isBG ? 'BANK_GUARANTEE_DOCUMENT' : 'FDR_SCAN';
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('doc_type', primaryDocType);

        await apiClient.post(`/instruments/${instrumentId}/documents/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        success(
          `${isBG ? 'Bank Guarantee' : 'FDR'} Submitted`,
          `Instrument ${data.fdr_number} submitted successfully with primary document attached.`
        );
      } catch (uploadErr: any) {
        // If document upload fails after instrument creation, transition smoothly
        // and allow institution to attach document from the detail page.
        const uploadMsg = formatApiError(uploadErr, 'Document attachment pending.');
        toastWarning(
          'Document Upload Notice',
          `Instrument was created, but document upload encountered: ${uploadMsg}. You can attach the document on the scrutiny page.`
        );
      }

      navigate(`/instruments/${instrumentId}`);
    } catch (err: any) {
      const msg = formatApiError(err, 'Failed to submit instrument. Please verify all fields.');
      setServerError(msg);
      toastError('Submission Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Warnings
  const jointHolderWarning =
    formValues.joint_holder_name &&
    !formValues.joint_holder_name.toLowerCase().includes('aicte') &&
    !formValues.joint_holder_name.toLowerCase().includes('all india council');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title={`Submit New ${isBG ? 'Bank Guarantee (BG)' : 'Fixed Deposit Receipt (FDR)'}`}
        subtitle="Submit a security deposit or bank guarantee in joint holding / favoring AICTE"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Instruments', path: '/instruments' },
          { label: 'Submit Instrument' },
        ]}
      />

      {/* Stepper Header */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
        {[
          { step: 1, label: 'Instrument & Bank' },
          { step: 2, label: 'Financials & AICTE Terms' },
          { step: 3, label: 'Upload & Review' },
        ].map((item, idx) => (
          <div key={item.step} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                currentStep > item.step
                  ? 'bg-emerald-600 text-white'
                  : currentStep === item.step
                  ? 'bg-primary text-white ring-4 ring-primary/20'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {currentStep > item.step ? <Check className="w-4 h-4" /> : item.step}
            </div>
            <span
              className={`hidden sm:inline text-xs font-semibold ${
                currentStep === item.step ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              {item.label}
            </span>
            {idx < 2 && <div className="hidden md:block w-8 h-px bg-slate-300 mx-2" />}
          </div>
        ))}
      </div>

      {serverError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(handleFinalSubmit)}>
        {/* Step 1: Instrument Type & Bank Details */}
        {currentStep === 1 && (
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Step 1: Instrument & Bank Information</h3>
              <AutoFillButton onApplyFields={handleApplyOcrFields} currentFormValues={formValues} />
            </div>

            {/* Instrument Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Security Deposit Instrument Type *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setValue('instrument_type', 'FDR')}
                  className={`p-3 rounded-lg border text-left flex items-start gap-3 transition-colors ${
                    !isBG
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <FileText className={`w-5 h-5 shrink-0 ${!isBG ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold">Fixed Deposit Receipt (FDR)</div>
                    <div className="text-[11px] text-slate-500">Joint deposit with AICTE Regional Officer</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setValue('instrument_type', 'BANK_GUARANTEE')}
                  className={`p-3 rounded-lg border text-left flex items-start gap-3 transition-colors ${
                    isBG
                      ? 'border-purple-500 bg-purple-50/50 text-purple-900 ring-2 ring-purple-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Shield className={`w-5 h-5 shrink-0 ${isBG ? 'text-purple-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold">Bank Guarantee (BG)</div>
                    <div className="text-[11px] text-slate-500">Irrevocable guarantee favoring AICTE</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isBG ? 'Bank Guarantee Number *' : 'FDR / Security Deposit Number *'}
                </label>
                <input
                  type="text"
                  placeholder={isBG ? 'e.g. BG-HDFC-2026-001' : 'e.g. FDR-SBIN-2026-9871'}
                  {...register('fdr_number')}
                  className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.fdr_number && (
                  <p className="text-xs text-red-600 mt-1">{errors.fdr_number.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Issuing Bank Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. State Bank of India"
                  {...register('bank_name')}
                  className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.bank_name && (
                  <p className="text-xs text-red-600 mt-1">{errors.bank_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Branch Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Connaught Place, New Delhi"
                  {...register('branch_name')}
                  className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.branch_name && (
                  <p className="text-xs text-red-600 mt-1">{errors.branch_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IFSC Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. SBIN0000691"
                  {...register('ifsc_code')}
                  className="w-full py-2 px-3 text-sm font-mono uppercase bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.ifsc_code && (
                  <p className="text-xs text-red-600 mt-1">{errors.ifsc_code.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                variant="primary"
                size="md"
                onClick={handleNextStep}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Proceed to Financials
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Financials & AICTE Terms */}
        {currentStep === 2 && (
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Step 2: {isBG ? 'Guarantee Amount & AICTE Terms' : 'Deposit Amount & AICTE Joint Holding'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isBG ? 'Guarantee Amount (₹) *' : 'Principal Deposit Amount (₹) *'}
                </label>
                <input
                  type="number"
                  placeholder="1500000"
                  {...register('amount')}
                  className="w-full py-2 px-3 text-sm font-mono bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.amount && (
                  <p className="text-xs text-red-600 mt-1">{errors.amount.message}</p>
                )}
                {formValues.amount && !isNaN(Number(formValues.amount)) && (
                  <p className="text-xs text-primary font-semibold mt-1">
                    Formatted: {formatINR(formValues.amount)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isBG ? 'Beneficiary Name *' : 'Joint Holder Title (Mandatory AICTE Clause) *'}
                </label>
                <input
                  type="text"
                  placeholder="All India Council for Technical Education"
                  {...register(isBG ? 'beneficiary_name' : 'joint_holder_name')}
                  className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.joint_holder_name && !isBG && (
                  <p className="text-xs text-red-600 mt-1">{errors.joint_holder_name.message}</p>
                )}
                {!isBG && jointHolderWarning && (
                  <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Must designate AICTE as joint holder
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isBG ? 'Effective / Issue Date *' : 'Date of Issue *'}
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
                  {isBG ? 'Guarantee Expiry Date *' : 'Date of Maturity *'}
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

              {isBG && (
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Claim Expiry Date *
                  </label>
                  <input
                    type="date"
                    {...register('claim_expiry_date')}
                    className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {errors.claim_expiry_date && (
                    <p className="text-xs text-red-600 mt-1">{errors.claim_expiry_date.message}</p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Recommended to be at least 30 days beyond guarantee expiry date.
                  </p>
                </div>
              )}

              {!isBG && (
                <div className="col-span-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('auto_renewal')}
                      className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                    />
                    <span className="text-xs text-slate-700 font-medium">
                      Auto-Renewal Clause: Permit issuing bank to auto-renew upon maturity if no claim is lodged
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                size="md"
                onClick={() => setCurrentStep(1)}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleNextStep}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Proceed to Document Upload
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Document Upload & Final Review */}
        {currentStep === 3 && (
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-6">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Step 3: Upload Scanned {isBG ? 'Bank Guarantee Document' : 'FDR Certificate'} & Submit
            </h3>

            <FileUpload
              selectedFile={selectedFile}
              onFileSelect={setSelectedFile}
              label={
                isBG
                  ? 'Original Bank Guarantee Document (BANK_GUARANTEE_DOCUMENT) *'
                  : 'Original FDR Certificate / Deposit Receipt (FDR_SCAN) *'
              }
            />

            {/* Summary Review Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 uppercase tracking-wide">Review Details</h4>
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div>
                  <span className="text-slate-500">Instrument Type:</span>{' '}
                  <span className="font-semibold">{isBG ? 'Bank Guarantee' : 'Fixed Deposit Receipt'}</span>
                </div>
                <div>
                  <span className="text-slate-500">{isBG ? 'BG Number:' : 'FDR Number:'}</span> {formValues.fdr_number}
                </div>
                <div>
                  <span className="text-slate-500">Bank:</span> {formValues.bank_name} (
                  {formValues.branch_name})
                </div>
                <div>
                  <span className="text-slate-500">Amount:</span> {formatINR(formValues.amount)}
                </div>
                <div>
                  <span className="text-slate-500">{isBG ? 'Validity / Expiry:' : 'Maturity:'}</span>{' '}
                  {formatDateIST(formValues.maturity_date)}
                </div>
                {isBG && formValues.claim_expiry_date && (
                  <div>
                    <span className="text-slate-500">Claim Expiry:</span>{' '}
                    {formatDateIST(formValues.claim_expiry_date)}
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-slate-500">{isBG ? 'Beneficiary:' : 'Joint Holder:'}</span>{' '}
                  {isBG ? formValues.beneficiary_name : formValues.joint_holder_name}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                size="md"
                onClick={() => setCurrentStep(2)}
                disabled={isSubmitting}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                leftIcon={<FileCheck2 className="w-4 h-4" />}
              >
                Submit {isBG ? 'Bank Guarantee' : 'FDR'} for Scrutiny
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

