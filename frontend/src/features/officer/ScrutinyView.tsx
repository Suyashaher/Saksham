import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowLeft,
  Building,
  Calendar,
  RefreshCw,
  Upload,
  ExternalLink,
  Plus,
  Loader2,
  FileSearch,
  X,
  Landmark,
  Maximize2,
  Minimize2,
  Clock,
} from 'lucide-react';
import { apiClient, formatApiError } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { formatINR, formatDateIST } from '../../utils/formatters';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { VerificationTag } from '../../components/ui/VerificationTag';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { TrustScoreBadge } from '../../components/ui/ai/TrustScoreBadge';
import { PredictionChip } from '../../components/ui/ai/PredictionChip';
import { DocumentMismatchFlags } from '../ai/ocr/DocumentMismatchFlags';
import { OcrComparisonCard } from '../ai/ocr/OcrComparisonCard';
import { aiApi } from '../../api/ai';
import { useAuth } from '../auth/AuthContext';

export const ScrutinyView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const { user } = useAuth();

  const isApproverOrAdmin = Boolean(
    user?.role && ['APPROVING_AUTHORITY', 'ADMIN'].includes(user.role)
  );
  const isOfficerOrAdmin = Boolean(
    user?.role && ['VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN'].includes(user.role)
  );

  const [remarks, setRemarks] = useState('');
  const [docVerifyConfirmed, setDocVerifyConfirmed] = useState(false);
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showDiscrepancyConfirm, setShowDiscrepancyConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);

  // Document preview state
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isDocExpanded, setIsDocExpanded] = useState(false);

  // Upload document modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('FDR_SCAN');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 1. Fetch Instrument Details
  const { data: instrument, isLoading } = useQuery({
    queryKey: queryKeys.instruments.detail(id!),
    queryFn: async () => {
      const res = await apiClient.get(`/instruments/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // 2. Fetch Bank Verification Record
  const { data: bankRecord } = useQuery({
    queryKey: queryKeys.instruments.bankVerification(id!),
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/instruments/${id}/verification`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });

  // 3. Fetch Documents
  const { data: rawDocuments } = useQuery({
    queryKey: queryKeys.instruments.documents(id!),
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/instruments/${id}/documents`);
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: !!id,
  });

  const documents: any[] = Array.isArray(rawDocuments)
    ? rawDocuments
    : Array.isArray(rawDocuments?.items)
    ? rawDocuments.items
    : [];

  const { data: trustData } = useQuery({
    queryKey: queryKeys.ai.trustScore(id!),
    queryFn: () => aiApi.getTrustScore(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  const { data: predData } = useQuery({
    queryKey: queryKeys.ai.predictedTime(id!),
    queryFn: () => aiApi.getPredictedTime(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  // Set default upload doc type based on instrument type
  useEffect(() => {
    if (instrument?.instrument_type === 'BANK_GUARANTEE') {
      setUploadDocType('BANK_GUARANTEE_DOCUMENT');
    } else {
      setUploadDocType('FDR_SCAN');
    }
  }, [instrument?.instrument_type]);

  // Sync selected doc with document list
  useEffect(() => {
    if (documents && documents.length > 0) {
      if (!selectedDocId || !documents.some((d: any) => d.id === selectedDocId)) {
        setSelectedDocId(documents[0].id);
      }
    } else {
      setSelectedDocId(null);
    }
  }, [documents, selectedDocId]);

  // Load preview when selectedDocId changes
  useEffect(() => {
    let activeUrl: string | null = null;
    let isCancelled = false;

    const loadPreview = async () => {
      if (!id || !selectedDocId) {
        setPreviewBlobUrl(null);
        setPreviewLoading(false);
        setPreviewError(null);
        return;
      }

      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const selectedDoc = documents.find((d: any) => d.id === selectedDocId);
        const fileName = selectedDoc?.file_name || '';
        const isPdf = fileName.toLowerCase().endsWith('.pdf') || !fileName.includes('.');
        const isPng = fileName.toLowerCase().endsWith('.png');
        const isJpg = fileName.toLowerCase().match(/\.(jpe?g)$/i);

        let mimeType = 'application/pdf';
        if (isPng) mimeType = 'image/png';
        else if (isJpg) mimeType = 'image/jpeg';
        else if (!isPdf) mimeType = 'application/octet-stream';

        const res = await apiClient.get(`/instruments/${id}/documents/${selectedDocId}/download`, {
          responseType: 'blob',
        });

        if (isCancelled) return;

        const blob = new Blob([res.data], { type: mimeType });
        activeUrl = window.URL.createObjectURL(blob);
        setPreviewBlobUrl(activeUrl);
      } catch (err: any) {
        if (!isCancelled) {
          setPreviewError(formatApiError(err, 'Failed to decrypt and load document preview.'));
          setPreviewBlobUrl(null);
        }
      } finally {
        if (!isCancelled) {
          setPreviewLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      isCancelled = true;
      if (activeUrl) {
        window.URL.revokeObjectURL(activeUrl);
      }
    };
  }, [id, selectedDocId, documents]);

  const handleQueryBank = async () => {
    setIsVerifyingBank(true);
    try {
      const res = await apiClient.post(`/instruments/${id}/verify`);
      if (res.data?.is_verified) {
        success('Bank Record Verified', 'Instrument details matched against official bank registry records.');
      } else {
        toastError('Verification Discrepancies', 'Bank registry query returned discrepancies.');
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.bankVerification(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.detail(id!) });
    } catch (err: any) {
      toastError('Bank Query Failed', formatApiError(err, 'Failed to query bank registry.'));
    } finally {
      setIsVerifyingBank(false);
    }
  };

  // Upload document handler
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toastError('File Required', 'Please select a document file to upload.');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('doc_type', uploadDocType);

      const res = await apiClient.post(`/instruments/${id}/documents/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      success('Document Uploaded', 'Document encrypted with AES-256 and uploaded successfully.');
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.documents(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.ocrRuns(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.detail(id!) });
      setShowUploadModal(false);
      setUploadFile(null);
      if (res.data?.id) {
        setSelectedDocId(res.data.id);
      }
    } catch (err: any) {
      toastError('Upload Failed', formatApiError(err, 'Failed to upload document.'));
    } finally {
      setIsUploading(false);
    }
  };

  // Verifying Officer: Verify Document & Forward to Approver
  const handleVerify = async () => {
    setIsProcessing(true);
    try {
      await apiClient.post(`/instruments/${id}/mark-verified`, {
        notes: remarks || 'Document verified by scrutiny officer and forwarded to Approver.',
      });
      success(
        'Document Verified & Forwarded',
        'Instrument marked as VERIFIED and forwarded to the Approving Authority for final approval.'
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.detail(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.officer.queue() });
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.all });
      setShowVerifyConfirm(false);
      navigate('/officer/queue');
    } catch (err: any) {
      toastError('Verification Failed', formatApiError(err, 'Could not verify instrument.'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Approver: Approve & Activate Instrument
  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await apiClient.post(`/instruments/${id}/activate`, {
        notes: remarks || 'Statutory approval granted by Approving Authority.',
      });
      success(
        'Instrument Approved & Activated',
        'The security deposit has been officially approved and activated.'
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.detail(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.officer.queue() });
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.all });
      setShowApproveConfirm(false);
      navigate(user?.role === 'APPROVING_AUTHORITY' ? '/approvals' : '/officer/queue');
    } catch (err: any) {
      toastError('Activation Failed', formatApiError(err, 'Could not activate instrument.'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Flag Discrepancy
  const handleFlagDiscrepancy = async () => {
    if (!remarks) {
      toastError('Observation Required', 'Please detail the discrepancy observations for the institution.');
      return;
    }

    setIsProcessing(true);
    try {
      await apiClient.post(`/instruments/${id}/flag-discrepancy`, {
        notes: remarks,
      });
      success('Discrepancy Flagged', 'The instrument is marked with DISCREPANCY and the institution notified.');
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.detail(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.officer.queue() });
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.all });
      setShowDiscrepancyConfirm(false);
      navigate('/officer/queue');
    } catch (err: any) {
      toastError('Action Failed', formatApiError(err, 'Could not record discrepancy.'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading scrutiny workspace...</div>;
  }

  if (!instrument) {
    return <div className="p-8 text-center text-slate-500">Instrument not found.</div>;
  }

  const isBG = instrument.instrument_type === 'BANK_GUARANTEE';
  const refNumber = instrument.reference_number || instrument.fdr_number || 'Deposit';
  const bankTitle = instrument.issuing_bank || instrument.bank_name || 'Bank';
  const branchTitle = instrument.branch || instrument.branch_name || 'N/A';
  const selectedDoc = documents.find((d: any) => d.id === selectedDocId);
  const isImageDoc = selectedDoc?.file_name?.toLowerCase().match(/\.(png|jpe?g|webp)$/i);

  const docTypeOptions = isBG
    ? [
        { value: 'BANK_GUARANTEE_DOCUMENT', label: 'Bank Guarantee Original Document' },
        { value: 'INVOCATION_NOTICE', label: 'Invocation / Claim Notice' },
        { value: 'AMENDMENT_LETTER', label: 'Amendment Letter' },
        { value: 'OTHER', label: 'Other Supporting Document' },
      ]
    : [
        { value: 'FDR_SCAN', label: 'Fixed Deposit Receipt (FDR) Scan' },
        { value: 'RENEWAL_REQUEST', label: 'Renewal Confirmation / Request' },
        { value: 'VERIFICATION_LETTER', label: 'Bank Verification Letter' },
        { value: 'OTHER', label: 'Other Supporting Document' },
      ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Scrutiny Console: ${refNumber}`}
        subtitle={`${bankTitle} • Branch: ${branchTitle}`}
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Scrutiny Queue', path: '/officer/queue' },
          { label: refNumber },
        ]}
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={instrument.status} size="md" />
            {trustData && (
              <TrustScoreBadge
                score={trustData.score}
                band={trustData.band}
                reasons={trustData.factors}
                weightsVersion={trustData.weights_version}
                dataSource={trustData.data_source}
              />
            )}
            {predData?.verification && (
              <PredictionChip
                predictedDays={predData.verification.predicted_days}
                intervalLow={predData.verification.interval_low}
                intervalHigh={predData.verification.interval_high}
                isHeuristic={predData.verification.is_heuristic}
                modelVersion={predData.verification.model_version}
                dataSource={predData.verification.data_source}
                reasons={predData.verification.reasons}
                maturityDate={instrument.maturity_date}
              />
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="black"
              size="sm"
              onClick={() => setShowUploadModal(true)}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Upload Document
            </Button>
            <Button
              variant="black"
              size="sm"
              onClick={() => navigate('/officer/queue')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Queue
            </Button>
          </div>
        }
      />

      {/* 4-Metric Instrument Executive Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Reference & Instrument Type */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-slate-950 text-amber-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
              {isBG ? 'Bank Guarantee Ref' : 'FDR Security Ref'}
            </span>
            <span className="text-sm font-bold text-slate-900 font-mono truncate block mt-0.5">
              {refNumber}
            </span>
            <span className="text-xs text-slate-500 block truncate mt-0.5">
              {isBG ? 'Irrevocable Bank Guarantee' : 'Fixed Deposit (Lien AICTE)'}
            </span>
          </div>
        </div>

        {/* Metric 2: Issuing Bank & Branch */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-slate-950 text-indigo-400 shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
              Issuing Bank & Branch
            </span>
            <span className="text-sm font-bold text-slate-900 truncate block mt-0.5">
              {bankTitle}
            </span>
            <span className="text-xs text-slate-500 block truncate mt-0.5">
              Branch: {branchTitle}
            </span>
          </div>
        </div>

        {/* Metric 3: Guaranteed Amount */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-slate-950 text-emerald-400 shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
              Guaranteed Valuation
            </span>
            <span className="text-base font-bold text-slate-900 font-mono block mt-0.5 text-emerald-700">
              {formatINR(instrument.amount)}
            </span>
            <span className="text-xs text-slate-500 block truncate mt-0.5">
              Joint: {instrument.beneficiary_name || instrument.joint_holder_name || 'AICTE'}
            </span>
          </div>
        </div>

        {/* Metric 4: Statutory Maturity */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-slate-950 text-cyan-400 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
              Maturity & Validity
            </span>
            <span className="text-sm font-bold text-slate-900 block mt-0.5">
              {formatDateIST(instrument.maturity_date)}
            </span>
            <span className="text-xs text-slate-500 block truncate mt-0.5">
              Issued: {formatDateIST(instrument.issue_date)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Symmetrical Scrutiny Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Left Column: Cross-Verification & Intelligence */}
        <div className="space-y-6 flex flex-col">
          {instrument.validation_flags && (
            <DocumentMismatchFlags
              flags={Array.isArray(instrument.validation_flags) ? instrument.validation_flags : [instrument.validation_flags]}
              instrumentId={id!}
            />
          )}

          {/* Declared vs Independent Bank Records Matrix */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Declared vs. Independent Bank Records
                </h3>
                <p className="text-xs text-slate-500">Cross-verified against official issuing bank API records</p>
              </div>
              <Button
                variant="black"
                size="sm"
                isLoading={isVerifyingBank}
                leftIcon={<RefreshCw className="w-4 h-4" />}
                onClick={handleQueryBank}
              >
                Query Bank Registry
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[
                {
                  label: isBG ? 'Bank Guarantee Number' : 'FDR / Account Number',
                  declared: refNumber,
                  bank: bankRecord?.bank_fdr_number || bankRecord?.reference_number || 'Awaiting API query',
                  match: !bankRecord || refNumber === (bankRecord?.bank_fdr_number || bankRecord?.reference_number),
                },
                {
                  label: isBG ? 'Guarantee Amount' : 'Principal Deposit Amount',
                  declared: formatINR(instrument.amount),
                  bank: bankRecord?.bank_amount ? formatINR(bankRecord.bank_amount) : 'Awaiting API query',
                  match: !bankRecord || Number(instrument.amount) === Number(bankRecord?.bank_amount),
                },
                {
                  label: isBG ? 'Guarantee Expiry Date' : 'Date of Maturity',
                  declared: formatDateIST(instrument.maturity_date),
                  bank: bankRecord?.bank_maturity_date ? formatDateIST(bankRecord.bank_maturity_date) : 'Awaiting API query',
                  match: !bankRecord || instrument.maturity_date === bankRecord?.bank_maturity_date,
                },
                {
                  label: isBG ? 'Beneficiary' : 'Joint Holder AICTE',
                  declared: instrument.beneficiary_name || instrument.joint_holder_name || 'AICTE',
                  bank: bankRecord?.bank_joint_holder || bankRecord?.beneficiary || 'Awaiting API query',
                  match: !bankRecord || Boolean(bankRecord?.joint_holder_match),
                },
              ].map((item, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span className="truncate pr-1">{item.label}</span>
                    {bankRecord && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${item.match ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                        {item.match ? 'MATCH' : 'MISMATCH'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Declared</span>
                      <span className="font-semibold text-slate-800 break-words">{item.declared}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Bank Record</span>
                      <span className="font-mono text-slate-800 break-words">{item.bank}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Document OCR Intelligence & Confidence */}
          <OcrComparisonCard
            instrument={instrument}
            documents={documents || []}
            onUploadClick={() => setShowUploadModal(true)}
            className="rounded-xl"
          />
        </div>

        {/* Right Column: Encrypted Document Viewer + Officer Decision Panel */}
        <div className="space-y-6 flex flex-col">
          {/* Document Scrutiny Viewer */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
            <div className="flex flex-col gap-2 pb-3 border-b border-slate-200 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-slate-900">Document Scrutiny Viewer</h3>
                </div>
                <div className="flex items-center gap-2">
                  {previewBlobUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => window.open(previewBlobUrl, '_blank')}
                        className="inline-flex items-center gap-1 text-xs text-white bg-black hover:bg-slate-900 px-2.5 py-1.5 rounded-md border border-black font-medium transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Tab</span>
                      </button>
                      {selectedDoc && (
                        <a
                          href={previewBlobUrl}
                          download={selectedDoc.file_name}
                          className="inline-flex items-center gap-1 text-xs text-white bg-black hover:bg-slate-900 px-2.5 py-1.5 rounded-md border border-black font-medium transition-colors"
                          title="Download decrypted file"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      )}
                    </>
                  )}
                  <Button
                    variant="black"
                    size="sm"
                    onClick={() => setShowUploadModal(true)}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Add Doc
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsDocExpanded(!isDocExpanded)}
                    className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
                    title={isDocExpanded ? 'Collapse viewer height' : 'Expand viewer height'}
                  >
                    {isDocExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Document Switcher Tabs if documents exist */}
              {documents && documents.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5">
                  {documents.map((doc: any) => {
                    const isSelected = doc.id === selectedDocId;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`px-3 py-1.5 text-xs rounded-md font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border bg-black text-white ${
                          isSelected
                            ? 'border-white ring-2 ring-slate-900 shadow-md'
                            : 'border-slate-800 text-slate-300 hover:text-white hover:border-slate-600'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 text-white" />
                        <span>{doc.file_name}</span>
                        <span className="text-[10px] text-slate-300 font-mono">(v{doc.version})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`bg-slate-100 border border-slate-300 rounded-lg overflow-hidden flex items-center justify-center relative transition-all duration-200 ${
              isDocExpanded ? 'h-[720px]' : 'h-[460px]'
            }`}>
              {previewLoading ? (
                <div className="text-center p-6 text-slate-500 text-xs space-y-2">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                  <p className="font-semibold text-slate-700">Decrypting AES-256 encrypted document...</p>
                  <p className="text-slate-400">Loading document securely from storage</p>
                </div>
              ) : previewError ? (
                <div className="text-center p-6 text-slate-600 max-w-sm space-y-3">
                  <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-800">Preview Unavailable</p>
                  <p className="text-xs text-slate-500">{previewError}</p>
                  <Button
                    variant="black"
                    size="sm"
                    onClick={() => {
                      const curr = selectedDocId;
                      setSelectedDocId(null);
                      setTimeout(() => setSelectedDocId(curr), 50);
                    }}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Retry Decrypt
                  </Button>
                </div>
              ) : previewBlobUrl ? (
                isImageDoc ? (
                  <div className="w-full h-full overflow-auto flex items-center justify-center p-4 bg-slate-900/5">
                    <img
                      src={previewBlobUrl}
                      alt={selectedDoc?.file_name || 'Document'}
                      className="max-w-full max-h-full object-contain rounded shadow"
                    />
                  </div>
                ) : (
                  <iframe
                    src={previewBlobUrl}
                    title="Document Preview"
                    className="w-full h-full border-none"
                  />
                )
              ) : (
                <div className="text-center p-8 text-slate-500 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200/80 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6 text-slate-400" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">No Document Attached</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    This deposit does not have any attached scan or certificate files yet.
                  </p>
                  <Button
                    variant="black"
                    size="sm"
                    onClick={() => setShowUploadModal(true)}
                    leftIcon={<Upload className="w-4 h-4" />}
                  >
                    Upload FDR Scan / BG Document
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Decision Action Panel */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {instrument.status === 'VERIFIED'
                    ? 'Approving Authority Decision'
                    : 'Officer Scrutiny & Verification'}
                </h3>
                <p className="text-xs text-slate-500">
                  {instrument.status === 'VERIFIED'
                    ? 'Review officer scrutiny findings and grant final activation approval.'
                    : 'Scrutinize deposit documents and forward to Approver for final activation.'}
                </p>
              </div>
              <StatusBadge status={instrument.status} size="sm" />
            </div>

            {/* If already in VERIFIED status */}
            {instrument.status === 'VERIFIED' ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-lg flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-teal-900 space-y-1">
                    <span className="font-bold text-teal-950 block">Document Verified by Officer</span>
                    <span>
                      The verifying officer has scrutinized and verified this document against branch records. The instrument is now in <strong className="font-mono">VERIFIED</strong> status, awaiting final approval and activation by the Approving Authority.
                    </span>
                  </div>
                </div>

                {isApproverOrAdmin ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Approver Decision Notes & Audit Remarks
                      </label>
                      <textarea
                        rows={3}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Enter approving authority notes, reference circulars, or audit remarks..."
                        className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="black"
                        size="md"
                        onClick={() => setShowApproveConfirm(true)}
                        isLoading={isProcessing}
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                        className="flex-1"
                      >
                        Approve & Activate Deposit
                      </Button>
                      <Button
                        variant="destructive"
                        size="md"
                        onClick={() => setShowDiscrepancyConfirm(true)}
                        isLoading={isProcessing}
                        leftIcon={<AlertTriangle className="w-4 h-4" />}
                        className="flex-1"
                      >
                        Flag Discrepancy
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                    Your verification has been recorded. This deposit is queued for review by the Approving Authority.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Officer verification checkbox declaration */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={docVerifyConfirmed}
                      onChange={(e) => setDocVerifyConfirmed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-black focus:ring-black cursor-pointer"
                    />
                    <span className="text-xs text-slate-800 font-medium leading-relaxed">
                      I verify that I have scrutinized this document, confirmed that deposit details match official records, and recommend this instrument to the Approver to be approved.
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scrutiny Observations & Audit Notes *
                  </label>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter verification observations, discrepancies, or notes for the audit trail..."
                    className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="black"
                    size="md"
                    onClick={() => setShowVerifyConfirm(true)}
                    isLoading={isProcessing}
                    disabled={!docVerifyConfirmed || isProcessing}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    className="flex-1"
                  >
                    Verify Document & Forward to Approver
                  </Button>
                  <Button
                    variant="destructive"
                    size="md"
                    onClick={() => setShowDiscrepancyConfirm(true)}
                    isLoading={isProcessing}
                    leftIcon={<AlertTriangle className="w-4 h-4" />}
                    className="flex-1"
                  >
                    Flag Discrepancy
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-slate-900">Upload Deposit Document</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadDocument} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Type *
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {docTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select File (PDF, PNG, JPEG up to 10MB) *
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                />
                {uploadFile && (
                  <p className="mt-1.5 text-[11px] text-emerald-600 font-medium">
                    Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-md border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed">
                Documents are AES-256-GCM encrypted immediately upon upload. Uploading an FDR scan will automatically enable AI OCR extraction and discrepancy validation.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="black"
                  size="sm"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="black"
                  size="sm"
                  isLoading={isUploading}
                  disabled={!uploadFile}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  {isUploading ? 'Encrypting & Uploading...' : 'Upload & Encrypt'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showVerifyConfirm}
        title="Confirm Document Verification & Forward to Approver"
        message="You are confirming that you have scrutinized the document and verified deposit details against branch records. The instrument will transition to VERIFIED status and will be forwarded to the Approving Authority for final approval."
        confirmLabel="Verify & Forward to Approver"
        confirmVariant="black"
        variant="info"
        isLoading={isProcessing}
        onConfirm={handleVerify}
        onCancel={() => setShowVerifyConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showApproveConfirm}
        title="Confirm Statutory Approval & Activation"
        message="As the Approving Authority, you are granting final approval. This instrument will immediately transition to ACTIVE status and write an immutable audit log entry."
        confirmLabel="Approve & Activate"
        confirmVariant="black"
        variant="info"
        isLoading={isProcessing}
        onConfirm={handleApprove}
        onCancel={() => setShowApproveConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showDiscrepancyConfirm}
        title="Flag Discrepancy"
        message="Flagging a discrepancy halts the activation and triggers a high-priority alert to the submitting institution to rectify their deposit records."
        confirmLabel="Flag Discrepancy"
        variant="danger"
        isLoading={isProcessing}
        onConfirm={handleFlagDiscrepancy}
        onCancel={() => setShowDiscrepancyConfirm(false)}
      />
    </div>
  );
};